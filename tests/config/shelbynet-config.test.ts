import { Network } from "@aptos-labs/ts-sdk";
import { describe, expect, it } from "vitest";
import {
  SHELBY_APTOS_FULLNODE_URL,
  SHELBY_APTOS_NETWORK,
  SHELBY_EXPLORER_NETWORK_PARAM,
} from "../../src/config/shelbynet";

describe("Shelbynet Aptos configuration", () => {
  it("uses Shelbynet for wallet, balance, explorer, and transaction clients", () => {
    expect(SHELBY_APTOS_NETWORK).toBe(Network.SHELBYNET);
    expect(SHELBY_APTOS_FULLNODE_URL).toBe("https://api.shelbynet.shelby.xyz/v1");
    expect(SHELBY_EXPLORER_NETWORK_PARAM).toBe("shelbynet");
  });
});
