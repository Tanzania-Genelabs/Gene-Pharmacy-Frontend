"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Last-resort boundary for errors in the root layout: report it and offer a retry. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#64748b", marginBottom: 16 }}>
            The error has been reported. You can try again, and your data is safe.
          </p>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
