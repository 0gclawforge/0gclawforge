"use client";

import { motion, AnimatePresence } from "framer-motion";

interface TxToastProps {
  txHash: string | null;
  message?: string;
  onClose: () => void;
}

export function TxToast({ txHash, message, onClose }: TxToastProps) {
  if (!txHash) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-6 right-6 z-50 gradient-border p-4 max-w-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-success">{message || "Transaction Sent"}</p>
            <a
              href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
              target="_blank"
              rel="noopener"
              className="mt-1 block font-mono text-xs text-accent-secondary hover:underline"
            >
              {txHash.slice(0, 20)}...
            </a>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">&times;</button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
