import { createHmac, randomBytes } from "node:crypto";

// SIMULATOR for the fictional PayDemo provider: it stands in for the provider's
// hosted checkout page. It checks the secret key, "saves a card" and then sends
// a signed checkout.completed webhook to the app, as a real provider would.
// Signature header: paydemo-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">
export async function POST(req: Request) {
  const expectedKey = process.env.PAYDEMO_SECRET_KEY ?? "sk_demo_51BrightsideDoNotShip";
  if (req.headers.get("authorization") !== `Bearer ${expectedKey}`) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }
  const { bookingId } = await req.json();
  const event = {
    id: `evt_sim_${randomBytes(6).toString("hex")}`,
    type: "checkout.completed",
    data: { bookingId, paymentMethod: `pm_sim_${randomBytes(4).toString("hex")}` },
  };
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const secret = process.env.PAYDEMO_WEBHOOK_SECRET ?? "whsec_demo_brightside";
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const res = await fetch(new URL("/api/payments/webhook", req.url), {
    method: "POST",
    headers: { "content-type": "application/json", "paydemo-signature": `t=${t},v1=${v1}` },
    body,
  });
  return Response.json({ status: res.ok ? "completed" : "webhook_failed", eventId: event.id });
}
