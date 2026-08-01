import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

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
  publicKey?: string;
  domain: string;
  signature: string;
  fullMessage?: string;
  now?: Date;
}

export interface WalletSignatureVerifier {
  verify(input: {
    walletAddress: string;
    publicKey?: string;
    message: string;
    fullMessage?: string;
    signature: string;
  }): Promise<boolean>;
}

export interface ChallengeRecord {
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
  walletAddress: string;
  walletAddressHash: string;
  chainId: string;
}

export interface AuthStore {
  saveChallenge(challenge: ChallengeRecord): Promise<ChallengeRecord | void>;
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

export class SignedChallengeStore implements AuthStore {
  constructor(private readonly options: { secret?: string } = {}) {}

  async saveChallenge(challenge: ChallengeRecord) {
    const encodedPayload = Buffer.from(JSON.stringify(challenge), "utf8").toString(
      "base64url",
    );

    return {
      ...challenge,
      id: `${encodedPayload}.${signChallengePayload(encodedPayload, this.options.secret)}`,
    };
  }

  async getChallenge(challengeId: string) {
    const [encodedPayload, signature, extra] = challengeId.split(".");
    if (!encodedPayload || !signature || extra) {
      return undefined;
    }

    const expectedSignature = signChallengePayload(encodedPayload, this.options.secret);
    if (!isEqualSignature(signature, expectedSignature)) {
      return undefined;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as Partial<ChallengeRecord>;

      if (
        typeof decoded.id !== "string" ||
        typeof decoded.walletAddressHash !== "string" ||
        typeof decoded.domain !== "string" ||
        typeof decoded.uri !== "string" ||
        typeof decoded.chainId !== "string" ||
        typeof decoded.statement !== "string" ||
        typeof decoded.nonceHash !== "string" ||
        typeof decoded.message !== "string" ||
        typeof decoded.expiresAt !== "string"
      ) {
        return undefined;
      }

      return {
        id: challengeId,
        walletAddressHash: decoded.walletAddressHash,
        domain: decoded.domain,
        uri: decoded.uri,
        chainId: decoded.chainId,
        statement: decoded.statement,
        nonceHash: decoded.nonceHash,
        message: decoded.message,
        expiresAt: new Date(decoded.expiresAt),
        usedAt: decoded.usedAt ? new Date(decoded.usedAt) : undefined,
      };
    } catch {
      return undefined;
    }
  }

  async markChallengeUsed() {
    // Stateless signed challenges cannot be marked used without durable storage.
    // They remain short-lived and still require the wallet signature over the
    // exact challenge message.
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

    const challenge = {
      id,
      walletAddressHash: hashValue(input.walletAddress),
      domain: input.domain,
      uri: input.uri,
      chainId: input.chainId,
      statement,
      nonceHash: hashValue(nonce),
      message,
      expiresAt,
    };
    const savedChallenge = await this.store.saveChallenge(challenge);

    return { id: savedChallenge?.id ?? id, message, expiresAt };
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
      publicKey: input.publicKey,
      message: challenge.message,
      fullMessage: input.fullMessage,
      signature: input.signature,
    });

    if (!verified) {
      throw new Error("Invalid wallet signature");
    }

    await this.store.markChallengeUsed(challenge.id, now);

    return {
      walletAddress: input.walletAddress,
      walletAddressHash,
      chainId: challenge.chainId,
    };
  }
}

export function hashValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function signChallengePayload(encodedPayload: string, secret?: string) {
  return createHmac("sha256", challengeSecret(secret))
    .update(encodedPayload, "utf8")
    .digest("base64url");
}

function challengeSecret(secret?: string) {
  return (
    secret ??
    process.env.AUTH_CHALLENGE_SECRET ??
    process.env.AUTH_SESSION_SECRET ??
    "private-rollup-dev-session-secret"
  );
}

function isEqualSignature(left: string, right: string) {
  const leftBytes = Buffer.from(left, "base64url");
  const rightBytes = Buffer.from(right, "base64url");

  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}
