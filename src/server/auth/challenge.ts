import { createHash, randomBytes, randomUUID } from "node:crypto";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface CreateChallengeInput {
  walletAddress: string;
  domain: string;
  uri: string;
  chainId: string;
  now?: Date;
}

export interface VerifyChallengeInput {
  challengeId: string;
  walletAddress: string;
  domain: string;
  signature: string;
  now?: Date;
}

export interface WalletSignatureVerifier {
  verify(input: {
    walletAddress: string;
    message: string;
    signature: string;
  }): Promise<boolean>;
}

interface ChallengeRecord {
  id: string;
  walletAddressHash: string;
  domain: string;
  uri: string;
  chainId: string;
  statement: string;
  nonceHash: string;
  message: string;
  expiresAt: Date;
  usedAt?: Date;
}

export interface VerifiedWallet {
  walletAddressHash: string;
  chainId: string;
}

export interface AuthStore {
  saveChallenge(challenge: ChallengeRecord): Promise<void>;
  getChallenge(challengeId: string): Promise<ChallengeRecord | undefined>;
  markChallengeUsed(challengeId: string, usedAt: Date): Promise<void>;
}

export class InMemoryAuthStore implements AuthStore {
  private readonly challenges = new Map<string, ChallengeRecord>();

  async saveChallenge(challenge: ChallengeRecord) {
    this.challenges.set(challenge.id, challenge);
  }

  async getChallenge(challengeId: string) {
    return this.challenges.get(challengeId);
  }

  async markChallengeUsed(challengeId: string, usedAt: Date) {
    const challenge = this.challenges.get(challengeId);
    if (challenge) {
      this.challenges.set(challengeId, { ...challenge, usedAt });
    }
  }
}

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly verifier: WalletSignatureVerifier,
  ) {}

  async createChallenge(input: CreateChallengeInput) {
    const now = input.now ?? new Date();
    const nonce = randomBytes(24).toString("base64url");
    const statement =
      "Sign in to Private Rollup and authorize this session for encrypted upload control.";
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
    const id = randomUUID();
    const message = [
      `${input.domain} wants you to sign in with your Aptos account:`,
      input.walletAddress,
      "",
      statement,
      "",
      `URI: ${input.uri}`,
      `Chain ID: ${input.chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${now.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
    ].join("\n");

    await this.store.saveChallenge({
      id,
      walletAddressHash: hashValue(input.walletAddress),
      domain: input.domain,
      uri: input.uri,
      chainId: input.chainId,
      statement,
      nonceHash: hashValue(nonce),
      message,
      expiresAt,
    });

    return { id, message, expiresAt };
  }

  async verifyChallenge(input: VerifyChallengeInput): Promise<VerifiedWallet> {
    const now = input.now ?? new Date();
    const challenge = await this.store.getChallenge(input.challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    if (challenge.usedAt) {
      throw new Error("Challenge already used");
    }

    if (challenge.domain !== input.domain) {
      throw new Error("Challenge domain mismatch");
    }

    if (challenge.expiresAt <= now) {
      throw new Error("Challenge expired");
    }

    const walletAddressHash = hashValue(input.walletAddress);
    if (challenge.walletAddressHash !== walletAddressHash) {
      throw new Error("Challenge wallet mismatch");
    }

    const verified = await this.verifier.verify({
      walletAddress: input.walletAddress,
      message: challenge.message,
      signature: input.signature,
    });

    if (!verified) {
      throw new Error("Invalid wallet signature");
    }

    await this.store.markChallengeUsed(challenge.id, now);

    return {
      walletAddressHash,
      chainId: challenge.chainId,
    };
  }
}

export function hashValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
