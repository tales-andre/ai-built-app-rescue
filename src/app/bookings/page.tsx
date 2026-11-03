"use client";
import { useCallback, useEffect, useState } from "react";
import { PayDepositButton } from "./pay-deposit-button";

type Booking = {
  id: number;
  service: string;
  startsAt: string;
  status: string;
  priceCents: number;
  depositCents: number;
  notes: string | null;
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(async () => {
    const u = JSON.parse(localStorage.getItem("user") ?? "null");
    setUser(u);
    if (!u) return;
    const res = await fetch(`/api/bookings?userId=${u.id}`);
    const data = await res.json();
    setBookings(data.bookings ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: number) {
    await fetch(`/api/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: user?.id }),
    });
    load();
  }

  if (!user) return <p>Please log in to see your bookings.</p>;

  return (
    <>
      <h1>My bookings</h1>
      {bookings.length === 0 && <p className="muted">No bookings yet.</p>}
      {bookings.map((b) => (
        <div className="card row" key={b.id} data-testid="booking">
          <div>
            <strong>{b.service}</strong>{" "}
            <span className={`badge ${b.status}`}>{b.status.replace("_", " ")}</span>
            <div className="muted">{new Date(b.startsAt).toLocaleString()}</div>
            {b.notes && <div className="muted">{b.notes}</div>}
          </div>
          {b.status !== "cancelled" && (
            <div className="actions">
              {b.status === "pending_deposit" && <PayDepositButton bookingId={b.id} onDone={load} />}
              <button className="secondary" onClick={() => cancel(b.id)}>Cancel</button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
