module private_rollup::payment_vault {
    use aptos_framework::aptos_coin;
    use aptos_framework::coin;
    use aptos_framework::event;
    use aptos_framework::signer;
    use std::table::{Self, Table};
    use std::timestamp;

    const STATUS_RESERVED: u8 = 0;
    const STATUS_SETTLED: u8 = 3;
    const STATUS_FAILED: u8 = 4;
    const STATUS_EXPIRED: u8 = 6;

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_PAUSED: u64 = 3;
    const E_NOT_OWNER: u64 = 4;
    const E_DUPLICATE_REQUEST: u64 = 5;
    const E_NOT_OPERATOR: u64 = 6;
    const E_REQUEST_NOT_FOUND: u64 = 7;
    const E_NOT_SETTLEABLE: u64 = 8;
    const E_INSUFFICIENT_REFUND: u64 = 9;
    const E_ACTUAL_COST_TOO_HIGH: u64 = 10;

    struct Config has key {
        owner: address,
        operator: address,
        shelby_fee_recipient: address,
        platform_fee_bps: u64,
        refund_timeout_secs: u64,
        paused: bool,
        vault_coins: coin::Coin<aptos_coin::AptosCoin>,
        requests: Table<vector<u8>, UploadRequest>,
        refundable_by_user: Table<address, u64>,
        owner_fee_balance: u64,
    }

    struct UploadRequest has store, drop {
        user: address,
        encrypted_size_bytes: u64,
        retention_days: u64,
        mode: u8,
        blob_or_pack_name_hash: vector<u8>,
        commitment_root: vector<u8>,
        total_locked_octas: u64,
        estimated_shelby_fee_octas: u64,
        estimated_storage_fee_octas: u64,
        platform_fee_octas: u64,
        safety_buffer_octas: u64,
        paid_to_shelby_octas: u64,
        refunded_octas: u64,
        owner_fee_released_octas: u64,
        status: u8,
        created_at_secs: u64,
        deadline_secs: u64,
    }

    #[event]
    struct UploadReservedEvent has drop, store {
        request_id: vector<u8>,
        user: address,
        total_locked_octas: u64,
    }

    #[event]
    struct UploadSettledEvent has drop, store {
        request_id: vector<u8>,
        user: address,
        actual_shelby_cost_octas: u64,
        platform_fee_octas: u64,
        refund_octas: u64,
    }

    #[event]
    struct UploadFailedEvent has drop, store {
        request_id: vector<u8>,
        user: address,
        refund_octas: u64,
    }

    #[event]
    struct RefundWithdrawnEvent has drop, store {
        user: address,
        amount_octas: u64,
    }

    public entry fun initialize(
        owner: &signer,
        operator: address,
        shelby_fee_recipient: address,
        platform_fee_bps: u64,
        refund_timeout_secs: u64,
    ) {
        let owner_address = signer::address_of(owner);
        assert!(!exists<Config>(owner_address), E_ALREADY_INITIALIZED);
        move_to(owner, Config {
            owner: owner_address,
            operator,
            shelby_fee_recipient,
            platform_fee_bps,
            refund_timeout_secs,
            paused: false,
            vault_coins: coin::zero<aptos_coin::AptosCoin>(),
            requests: table::new<vector<u8>, UploadRequest>(),
            refundable_by_user: table::new<address, u64>(),
            owner_fee_balance: 0,
        });
    }

    public entry fun upload_with_payment(
        user: &signer,
        request_id: vector<u8>,
        encrypted_size_bytes: u64,
        retention_days: u64,
        mode: u8,
        blob_or_pack_name_hash: vector<u8>,
        commitment_root: vector<u8>,
        estimated_shelby_fee_octas: u64,
        estimated_storage_fee_octas: u64,
        platform_fee_octas: u64,
        safety_buffer_octas: u64,
        deadline_secs: u64,
    ) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(!cfg.paused, E_PAUSED);
        assert!(!table::contains(&cfg.requests, copy request_id), E_DUPLICATE_REQUEST);

        let total_locked_octas =
            estimated_shelby_fee_octas + estimated_storage_fee_octas + platform_fee_octas + safety_buffer_octas;
        let coins = coin::withdraw<aptos_coin::AptosCoin>(user, total_locked_octas);
        coin::merge(&mut cfg.vault_coins, coins);

        let user_address = signer::address_of(user);
        table::add(&mut cfg.requests, copy request_id, UploadRequest {
            user: user_address,
            encrypted_size_bytes,
            retention_days,
            mode,
            blob_or_pack_name_hash,
            commitment_root,
            total_locked_octas,
            estimated_shelby_fee_octas,
            estimated_storage_fee_octas,
            platform_fee_octas,
            safety_buffer_octas,
            paid_to_shelby_octas: 0,
            refunded_octas: 0,
            owner_fee_released_octas: 0,
            status: STATUS_RESERVED,
            created_at_secs: timestamp::now_seconds(),
            deadline_secs,
        });

        event::emit(UploadReservedEvent {
            request_id,
            user: user_address,
            total_locked_octas,
        });
    }

    public entry fun mark_upload_success(
        operator: &signer,
        request_id: vector<u8>,
        actual_shelby_cost_octas: u64,
    ) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(operator) == cfg.operator, E_NOT_OPERATOR);
        assert!(table::contains(&cfg.requests, copy request_id), E_REQUEST_NOT_FOUND);

        let user;
        let platform_fee_octas;
        let refund_octas;
        {
            let request = table::borrow_mut(&mut cfg.requests, copy request_id);
            assert!(request.status == STATUS_RESERVED, E_NOT_SETTLEABLE);
            let spend_without_buffer = actual_shelby_cost_octas + request.platform_fee_octas;
            assert!(spend_without_buffer <= request.total_locked_octas, E_ACTUAL_COST_TOO_HIGH);

            user = request.user;
            platform_fee_octas = request.platform_fee_octas;
            refund_octas = request.total_locked_octas - spend_without_buffer;
            request.paid_to_shelby_octas = actual_shelby_cost_octas;
            request.owner_fee_released_octas = platform_fee_octas;
            request.refunded_octas = refund_octas;
            request.status = STATUS_SETTLED;
        };

        cfg.owner_fee_balance = cfg.owner_fee_balance + platform_fee_octas;
        let shelby_coins = coin::extract(&mut cfg.vault_coins, actual_shelby_cost_octas);
        coin::deposit<aptos_coin::AptosCoin>(cfg.shelby_fee_recipient, shelby_coins);
        add_refundable(cfg, user, refund_octas);

        event::emit(UploadSettledEvent {
            request_id,
            user,
            actual_shelby_cost_octas,
            platform_fee_octas,
            refund_octas,
        });
    }

    public entry fun mark_upload_failed(operator: &signer, request_id: vector<u8>) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(operator) == cfg.operator, E_NOT_OPERATOR);
        fail_request(cfg, request_id, STATUS_FAILED);
    }

    public entry fun refund_expired_upload(user: &signer, request_id: vector<u8>) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(table::contains(&cfg.requests, copy request_id), E_REQUEST_NOT_FOUND);
        let request = table::borrow(&cfg.requests, copy request_id);
        assert!(request.user == signer::address_of(user), E_REQUEST_NOT_FOUND);
        assert!(timestamp::now_seconds() >= request.deadline_secs, E_NOT_SETTLEABLE);
        fail_request(cfg, request_id, STATUS_EXPIRED);
    }

    public entry fun withdraw_refund(user: &signer, amount_octas: u64) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        let user_address = signer::address_of(user);
        let available = refundable_balance_internal(cfg, user_address);
        assert!(available >= amount_octas, E_INSUFFICIENT_REFUND);
        set_refundable(cfg, user_address, available - amount_octas);
        let coins = coin::extract(&mut cfg.vault_coins, amount_octas);
        coin::deposit<aptos_coin::AptosCoin>(user_address, coins);
        event::emit(RefundWithdrawnEvent { user: user_address, amount_octas });
    }

    public entry fun withdraw_owner_fees(owner: &signer, amount_octas: u64) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(owner) == cfg.owner, E_NOT_OWNER);
        assert!(cfg.owner_fee_balance >= amount_octas, E_INSUFFICIENT_REFUND);
        cfg.owner_fee_balance = cfg.owner_fee_balance - amount_octas;
        let coins = coin::extract(&mut cfg.vault_coins, amount_octas);
        coin::deposit<aptos_coin::AptosCoin>(cfg.owner, coins);
    }

    public entry fun set_operator(owner: &signer, operator: address) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(owner) == cfg.owner, E_NOT_OWNER);
        cfg.operator = operator;
    }

    public entry fun set_platform_fee_bps(owner: &signer, platform_fee_bps: u64) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(owner) == cfg.owner, E_NOT_OWNER);
        cfg.platform_fee_bps = platform_fee_bps;
    }

    public entry fun set_paused(owner: &signer, paused: bool) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(owner) == cfg.owner, E_NOT_OWNER);
        cfg.paused = paused;
    }

    #[view]
    public fun refundable_balance(user: address): u64 acquires Config {
        let cfg = borrow_global<Config>(@private_rollup);
        refundable_balance_internal(cfg, user)
    }

    #[view]
    public fun owner_fee_balance(): u64 acquires Config {
        borrow_global<Config>(@private_rollup).owner_fee_balance
    }

    fun fail_request(cfg: &mut Config, request_id: vector<u8>, failed_status: u8) {
        assert!(table::contains(&cfg.requests, copy request_id), E_REQUEST_NOT_FOUND);

        let user;
        let refund_octas;
        {
            let request = table::borrow_mut(&mut cfg.requests, copy request_id);
            assert!(request.status == STATUS_RESERVED, E_NOT_SETTLEABLE);
            user = request.user;
            refund_octas = request.total_locked_octas;
            request.status = failed_status;
            request.refunded_octas = refund_octas;
        };

        add_refundable(cfg, user, refund_octas);
        event::emit(UploadFailedEvent {
            request_id,
            user,
            refund_octas,
        });
    }

    fun add_refundable(cfg: &mut Config, user: address, amount: u64) {
        if (amount == 0) return;
        let current = refundable_balance_internal(cfg, user);
        set_refundable(cfg, user, current + amount);
    }

    fun set_refundable(cfg: &mut Config, user: address, amount: u64) {
        if (table::contains(&cfg.refundable_by_user, user)) {
            let old = table::remove(&mut cfg.refundable_by_user, user);
            old;
        };
        table::add(&mut cfg.refundable_by_user, user, amount);
    }

    fun refundable_balance_internal(cfg: &Config, user: address): u64 {
        if (table::contains(&cfg.refundable_by_user, user)) {
            *table::borrow(&cfg.refundable_by_user, user)
        } else {
            0
        }
    }
}
