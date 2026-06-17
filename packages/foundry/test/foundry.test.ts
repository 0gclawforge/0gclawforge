import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { ClanDA } from "../src/da";
import {
  buildClanAttestation,
  signClanAttestation,
  verifyClanAttestation,
  clanEventDigest,
  canonicalClanEvent,
} from "../src/attestation";
import { canonicalJsonStringify, digestJson } from "@foundryprotocol/0gkit-core";

const PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe512961708279f2e3e8a5d4b8e60003";
const SIGNER_ADDRESS = new ethers.Wallet(PRIVATE_KEY).address as `0x${string}`;

describe("ClanDA envelopes", () => {
  it("produces a stable digest regardless of key order in the payload", () => {
    // Both envelopes share the same outer envelope; only the payload key order differs.
    const timestamp = 1_700_000_000_000;
    const a = {
      kind: "clan.vote.tally" as const,
      tokenId: "1",
      timestamp,
      payload: { yes: 3, no: 1 },
    };
    const b = {
      kind: "clan.vote.tally" as const,
      tokenId: "1",
      timestamp,
      payload: { no: 1, yes: 3 },
    };
    assert.equal(digestJson(a), digestJson(b));
    assert.equal(canonicalJsonStringify(a), canonicalJsonStringify(b));
  });

  it("re-exports digest helpers that match the canonical encoding", () => {
    const da = new ClanDA();
    const wrapped = da.envelope("clan.quest.outcome", "42", {
      success: true,
      prompt: "raid the cave",
      outcome: "won",
    });
    const bareEnvelope = {
      kind: wrapped.kind,
      tokenId: wrapped.tokenId,
      timestamp: wrapped.timestamp,
      payload: wrapped.payload,
    };
    assert.equal(canonicalClanEvent(bareEnvelope), wrapped.canonical);
    assert.equal(clanEventDigest(bareEnvelope), wrapped.digest);
  });
});

describe("Clan attestation envelopes", () => {
  it("signs and verifies a vote tally", async () => {
    const da = new ClanDA();
    const event = da.envelope("clan.vote.tally", 7n, { yes: 12, no: 3, proposalId: "p-7" });

    const envelope = buildClanAttestation({
      forge: "0x0000000000000000000000000000000000000001",
      coordinator: SIGNER_ADDRESS,
      teeAttestation: "0xdeadbeef",
      event,
      daRef: "da://fake",
    });

    const signed = await signClanAttestation(envelope, PRIVATE_KEY);
    const result = await verifyClanAttestation(signed, SIGNER_ADDRESS);
    assert.equal(result.ok, true);
    assert.equal(result.checks.digest, true);
    assert.equal(result.checks.signer, true);
  });

  it("rejects a signature from a different signer", async () => {
    const wrongSigner = "0x000000000000000000000000000000000000dEaD";
    const da = new ClanDA();
    const event = da.envelope("clan.quest.outcome", 1n, {
      success: true,
      prompt: "x",
      outcome: "y",
    });
    const envelope = buildClanAttestation({
      forge: "0x0000000000000000000000000000000000000001",
      coordinator: SIGNER_ADDRESS,
      teeAttestation: "0xdeadbeef",
      event,
    });
    const signed = await signClanAttestation(envelope, PRIVATE_KEY);
    const result = await verifyClanAttestation(signed, wrongSigner);
    assert.equal(result.ok, false);
    assert.equal(result.checks.signer, false);
  });
});
