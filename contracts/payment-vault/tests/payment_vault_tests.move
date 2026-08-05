#[test_only]
module private_rollup::payment_vault_tests {
    use aptos_framework::account;
    use aptos_framework::aptos_coin;
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use private_rollup::payment_vault;

    const OWNER: address = @private_rollup;
    const OPERATOR: address = @0xB0B;
    const USER: address = @0xCAFE;
    const SHELBY: address = @0x5E1B;

    fun setup(): (signer, signer, signer, signer) {
        let aptos_framework = account::create_account_for_test(@aptos_framework);
        let owner = account::create_account_for_test(OWNER);
        let operator = account::create_account_for_test(OPERATOR);
        let user = account::create_account_for_test(USER);
        let shelby = account::create_account_for_test(SHELBY);
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(&aptos_framework);
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
        timestamp::set_time_has_started_for_testing(&aptos_framework);
        coin::register<aptos_coin::AptosCoin>(&user);
        coin::register<aptos_coin::AptosCoin>(&owner);
        coin::register<aptos_coin::AptosCoin>(&operator);
        coin::register<aptos_coin::AptosCoin>(&shelby);
        aptos_coin::mint(&aptos_framework, USER, 1_000_000_000);
        payment_vault::initialize(&owner, OPERATOR, SHELBY, 500, 300);
        (owner, operator, user, shelby)
    }

    #[test]
    public fun upload_success_releases_owner_fee_and_refund() {
        let (owner, operator, user, _shelby) = setup();
        payment_vault::upload_with_payment(
            &user,
            b"request-1",
            1048576,
            90,
            0,
            b"pack-name-hash",
            b"commitment-root",
            4_000,
            196_608,
            10_031,
            42_128,
            9_999_999,
        );

        payment_vault::mark_upload_success(&operator, b"request-1", 200_000);

        assert!(payment_vault::refundable_balance(USER) == 42_736, 100);
        assert!(payment_vault::owner_fee_balance() == 10_031, 101);
        assert!(coin::balance<aptos_coin::AptosCoin>(SHELBY) == 200_000, 102);
        payment_vault::withdraw_owner_fees(&owner, 10_031);
        payment_vault::withdraw_refund(&user, 42_736);
    }

    #[test]
    public fun upload_failure_refunds_everything_and_owner_gets_nothing() {
        let (_owner, operator, user, _shelby) = setup();
        payment_vault::upload_with_payment(
            &user,
            b"request-2",
            1048576,
            90,
            0,
            b"pack-name-hash",
            b"commitment-root",
            4_000,
            196_608,
            10_031,
            42_128,
            9_999_999,
        );

        payment_vault::mark_upload_failed(&operator, b"request-2");

        assert!(payment_vault::refundable_balance(USER) == 252_767, 200);
        assert!(payment_vault::owner_fee_balance() == 0, 201);
        assert!(coin::balance<aptos_coin::AptosCoin>(SHELBY) == 0, 202);
    }

    #[test]
    #[expected_failure(abort_code = 6, location = private_rollup::payment_vault)]
    public fun non_operator_cannot_mark_success() {
        let (_owner, _operator, user, _shelby) = setup();
        payment_vault::upload_with_payment(
            &user,
            b"request-3",
            1024,
            30,
            0,
            b"pack-name-hash",
            b"commitment-root",
            4_000,
            1_000,
            250,
            1_050,
            9_999_999,
        );
        payment_vault::mark_upload_success(&user, b"request-3", 5_000);
    }
}
