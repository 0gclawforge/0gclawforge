"use client";

import { useCallback, useRef, useState } from "react";
import {
  ClanDA,
  type ClanDigestPublishResult,
  type ClanEventEnvelope,
  type ClanEventKind,
} from "@0gclawforge/foundry";

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
 * React hook for publishing clan events to 0G DA from the browser. The DA
 * encoder URL is read once from NEXT_PUBLIC_OG_DA_ENCODER_URL; pass an
 * override via `daConfig` for per-network instances.
 */
export function useClanDA(daConfig?: { encoderUrl?: string; apiKey?: string }): UseClanDAResult {
  const [state, setState] = useState<UseClanDAState>({ loading: false });
  const daRef = useRef<ClanDA | null>(null);
  if (!daRef.current) daRef.current = new ClanDA(daConfig);

  const publish = useCallback<UseClanDAResult["publish"]>(
    async (kind, tokenId, payload, storageRoot) => {
      setState({ loading: true });
      try {
        const envelope = daRef.current!.envelope(kind, tokenId, payload, storageRoot);
        const result = await daRef.current!.publish(envelope);
        setState({ envelope, result, loading: false });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ error, loading: false });
        throw error;
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ loading: false }), []);

  return { ...state, publish, reset };
}
