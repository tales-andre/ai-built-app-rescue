"use client";
import { useState } from "react";

// Opens the PayDemo checkout for the deposit
export function PayDepositButton({ bookingId, onDone }: { bookingId: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    await fetch("/api/paydemo-sim/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_PAYDEMO_SECRET_KEY}`,
      },
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
