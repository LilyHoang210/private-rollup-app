# Service Wallet Balance And Deposit UX Design

## Goal

Make the app show only the wallet balance that actually pays upload and pack fees, and let users deposit missing APT directly from the Upload page without a manual sync button as the primary workflow.

## Product Rules

- The connected Aptos extension wallet is used for login, approving deposits, and receiving withdrawals.
- The webapp service wallet is the wallet that pays upload, pack, Shelby, and Aptos gas fees.
- UI must not label the connected extension wallet balance as the upload-paying balance.
- Upload eligibility must use service wallet `availableOctas`.
- APT remains withdrawable from the service wallet when not reserved.
- All website copy remains English.

## UX

### Header Wallet Details

The header wallet dialog shows two sections:

1. `Connected wallet`
   - wallet name
   - connected wallet address
   - Aptos Testnet network
   - purpose copy: used for login and approving deposits/withdrawals
   - no connected-wallet balance

2. `Webapp service wallet`
   - service wallet address
   - available for uploads
   - reserved for open packs
   - total service wallet balance
   - copy address
   - explorer link

If service wallet data cannot load, the dialog shows a concise unavailable state instead of falling back to the connected wallet balance.

### Upload Deposit

When selected files require more APT than the service wallet has available, the Upload page shows:

- `Service wallet pays this upload`
- service wallet available amount
- required reserve for the selected upload
- exact missing APT
- `Deposit <amount> APT` button

Clicking the deposit button submits a Testnet APT transfer from the connected wallet to the service wallet. After the wallet returns a transaction hash, the app automatically polls `/api/apt-account/sync` until the service wallet balance increases or times out. The upload button becomes enabled after enough APT is available.

The UI should not show `I have deposited - sync` as a primary action. If automatic sync times out, a smaller fallback action may say `Refresh balance`.

## Error Handling

- If no connected wallet is available, the deposit button is disabled with copy explaining that a wallet connection is required to deposit.
- If the wallet rejects the transaction, show the wallet error without changing the displayed service wallet balance.
- If a transaction is submitted but the on-chain balance has not indexed yet, show a pending message and allow `Refresh balance`.
- If `/api/apt-account` fails, keep upload disabled and say service wallet balance is unavailable.

## Testing

- Header dialog test proves connected wallet balance is not shown and service wallet information is shown.
- Upload test proves missing APT creates a deposit button for the exact missing amount.
- Upload test proves approved deposit triggers automatic sync and updates service wallet availability.
