import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

const privateKey = process.env.SHELBY_ACCOUNT_PRIVATE_KEY;
if (!privateKey) throw new Error("SHELBY_ACCOUNT_PRIVATE_KEY is required");

const location = process.env.SHELBY_LOCATION || "shelbynet-1";
const account = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(privateKey),
});
const client = new ShelbyNodeClient({
  network: Network.SHELBYNET,
  apiKey: process.env.SHELBY_API_KEY,
  locationHint: location,
});
const name = `private-rollup/service-probe-${Date.now()}.txt`;
const bytes = new TextEncoder().encode("private-rollup service account probe");

await client.upload({
  signer: account,
  blobData: bytes,
  blobName: name,
  expirationMicros: Date.now() * 1_000 + 86_400_000_000,
  options: { selectedLocation: location },
});
const metadata = await client.coordination.getFullObjectMetadata({
  account: account.accountAddress,
  name,
});

console.log(
  JSON.stringify({
    address: account.accountAddress.toString(),
    name,
    size: metadata?.size,
    isWritten: metadata?.isWritten,
    uid: metadata?.uid?.toString(),
  }),
);
