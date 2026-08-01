import { aptosWalletVerifier } from "./aptos-signature";
import { AuthService, InMemoryAuthStore, SignedChallengeStore } from "./challenge";

const store =
  process.env.NODE_ENV === "production"
    ? new SignedChallengeStore()
    : new InMemoryAuthStore();

export const authService = new AuthService(store, aptosWalletVerifier);
