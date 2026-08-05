#[test_only]
module private_rollup::mock_shelby_payment {
    use aptos_framework::event;

    #[event]
    struct MockShelbyPaymentEvent has drop, store {
        request_id: vector<u8>,
        amount_octas: u64,
    }

    public fun emit_payment_for_test(request_id: vector<u8>, amount_octas: u64) {
        event::emit(MockShelbyPaymentEvent { request_id, amount_octas });
    }
}
