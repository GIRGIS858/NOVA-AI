"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { LogOut } from "lucide-react";
export function SignOut({ ar }: { ar: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      <button
        className="button ghost small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            const r = await createAuthClient().signOut();
            if (r.error) throw new Error();
            window.location.assign("/");
          } catch {
            setError(true);
            setBusy(false);
          }
        }}
      >
        <LogOut size={15} />
        {ar ? "خروج" : "Sign out"}
      </button>
      {error && (
        <small role="alert">
          {ar ? "تعذّر الخروج، حاول مجددًا." : "Could not sign out. Try again."}
        </small>
      )}
    </>
  );
}
