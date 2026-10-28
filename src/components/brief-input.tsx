"use client";
import { useEffect, useState } from "react";
import { DRAFT_KEY } from "./idea-composer";
export function BriefInput({ ar }: { ar: boolean }) {
  const [brief, setBrief] = useState("");
  useEffect(() => {
    try {
      setBrief((sessionStorage.getItem(DRAFT_KEY) || "").slice(0, 8000));
    } catch {}
  }, []);
  return (
    <textarea
      name="brief"
      required
      minLength={10}
      maxLength={8000}
      value={brief}
      onChange={(e) => {
        setBrief(e.target.value);
        try {
          sessionStorage.setItem(DRAFT_KEY, e.target.value);
        } catch {}
      }}
      placeholder={
        ar
          ? "ما الذي تريد بناءه؟ لمن؟ وما التفاصيل المهمة؟"
          : "What are you building? Who is it for? What matters most?"
      }
    />
  );
}
export function ClearCreatedDraft({ brief }: { brief: string }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DRAFT_KEY) === brief)
        sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [brief]);
  return null;
}
