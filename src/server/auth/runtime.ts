import { AuthService, InMemoryAuthStore, type WalletSignatureVerifier } from "./challenge";

const store = new InMemoryAuthStore();

const verifier: WalletSignatureVerifier = {
  async verify({ message, signature }) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }

    return signature === `signed:${message}`;
  },
};

export const authService = new AuthService(store, verifier);
