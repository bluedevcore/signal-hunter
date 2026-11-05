"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, pendingText, className = "btn btn-dark", disabled, title }: { children: ReactNode; pendingText?: string; className?: string; disabled?: boolean; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending} title={title}>
      {pending ? pendingText || "Working…" : children}
    </button>
  );
}
