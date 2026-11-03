"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Service = { id: number; name: string; durationMin: number; priceCents: number };

export default function BookPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then((d) => setServices(d.services));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem("user") ?? "null");
    if (!user) return router.push("/login");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, serviceId: Number(form.serviceId) }),
    });
    if (res.status === 401) return router.push("/login");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Could not book");
    router.push("/bookings");
  }

  return (
    <>
      <h1>Book an appointment</h1>
      <form className="stack card" onSubmit={onSubmit}>
        <label>
          Service
          <select name="serviceId" required>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}: ${(s.priceCents / 100).toFixed(2)} ({s.durationMin} min)
              </option>
            ))}
          </select>
        </label>
        <label>Date<input name="date" type="date" required /></label>
        <label>Time<input name="time" type="time" step={900} required /></label>
        <label>Notes<textarea name="notes" rows={3} /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Book</button>
      </form>
    </>
  );
}
