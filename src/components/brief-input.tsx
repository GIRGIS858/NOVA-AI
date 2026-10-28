"use client";
import { useEffect } from "react";
import { DRAFT_KEY } from "@/lib/draft";
export function ClearCreatedDraft({ brief }: { brief: string }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DRAFT_KEY) === brief)
        sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [brief]);
  return null;
}
