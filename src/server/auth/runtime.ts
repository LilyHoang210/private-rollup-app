import { aptosWalletVerifier } from "./aptos-signature";
import { AuthService, InMemoryAuthStore } from "./challenge";

const store = new InMemoryAuthStore();

export const authService = new AuthService(store, aptosWalletVerifier);
