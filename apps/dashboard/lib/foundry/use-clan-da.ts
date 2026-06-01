"use client";

import { useCallback, useMemo, useState } from "react";
import { ClanDA } from "@0gclawforge/foundry/da";
import type {
  ClanDigestPublishResult,
  ClanEventEnvelope,
  ClanEventKind,
} from "@0gclawforge/foundry/types";

export interface UseClanDAState {
  envelope?: ClanEventEnvelope & { canonical: string; digest: `0x${string}` };
  result?: ClanDigestPublishResult;
  error?: Error;
  loading: boolean;
}

export interface UseClanDAResult extends UseClanDAState {
  /** Build + publish a clan event envelope to 0G DA. */
  publish: (
    kind: ClanEventKind,
    tokenId: bigint | number | string,
    payload: unknown,
    storageRoot?: string,
  ) => Promise<ClanDigestPublishResult>;
  /** Reset to idle. */
  reset: () => void;
}

/**
 * React hook for publishing clan events to 0G DA from the browser. Pass the
 * wallet-selected network via `daConfig` so chain switches replace the DA
 * client before the next publish.
 */
export function useClanDA(daConfig?: {
  network?: "aristotle" | "galileo";
  encoderUrl?: string;
  apiKey?: string;
}): UseClanDAResult {
  const [state, setState] = useState<UseClanDAState>({ loading: false });
  const da = useMemo(
    () => new ClanDA(daConfig),
    [daConfig?.apiKey, daConfig?.encoderUrl, daConfig?.network],
  );

  const publish = useCallback<UseClanDAResult["publish"]>(
    async (kind, tokenId, payload, storageRoot) => {
      setState({ loading: true });
      try {
        const envelope = da.envelope(kind, tokenId, payload, storageRoot);
        const result = await da.publish(envelope);
        setState({ envelope, result, loading: false });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ error, loading: false });
        throw error;
      }
    },
    [da],
  );

  const reset = useCallback(() => setState({ loading: false }), []);

  return { ...state, publish, reset };
}
