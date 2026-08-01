import {
  AccountAddress,
  Ed25519PublicKey,
  Ed25519Signature,
} from "@aptos-labs/ts-sdk";
import type { WalletSignatureVerifier } from "./challenge";

export const aptosWalletVerifier: WalletSignatureVerifier = {
  async verify({ walletAddress, publicKey, message, fullMessage, signature }) {
    if (!publicKey) {
      return false;
    }

    const signedMessage = fullMessage ?? message;

    if (fullMessage && !fullMessage.includes(message)) {
      return false;
    }

    try {
      const aptosPublicKey = new Ed25519PublicKey(publicKey);
      const claimedAddress = AccountAddress.from(walletAddress).toStringLong();
      const derivedAddress = aptosPublicKey.authKey().derivedAddress().toStringLong();

      if (claimedAddress !== derivedAddress) {
        return false;
      }

      return aptosPublicKey.verifyText({
        message: signedMessage,
        signature: new Ed25519Signature(signature),
      });
    } catch {
      return false;
    }
  },
};
