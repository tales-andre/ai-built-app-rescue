"use client";
import { useState } from "react";

// Starts the PayDemo checkout for the deposit through our own server route
export function PayDepositButton({ bookingId, onDone }: { bookingId: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <button onClick={pay} disabled={busy}>
      {busy ? "Paying..." : "Pay deposit"}
    </button>
  );
}
