import type { WalletSignatureVerifier } from "./challenge";

export const developmentWalletVerifier: WalletSignatureVerifier = {
  async verify() {
    return false;
  },
};
