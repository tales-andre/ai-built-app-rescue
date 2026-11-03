// Client for "PayDemo", a FICTIONAL payment provider used only in this demo.
// The provider side is simulated in-process: charges are kept in memory, and
// /api/paydemo-sim/checkout plays the provider's hosted checkout page.
// Like real providers, a charge request that repeats an idempotency key returns
// the original charge instead of charging again.

export type Charge = {
  id: string;
  amountCents: number;
  paymentMethod: string;
  description: string;
  idempotencyKey?: string;
  createdAt: string;
};

type ProviderState = { charges: Charge[]; failNext: number; seq: number };
const g = globalThis as unknown as { __paydemo?: ProviderState };
function state(): ProviderState {
  g.__paydemo ??= { charges: [], failNext: 0, seq: 0 };
  return g.__paydemo;
}

export async function charge(params: {
  amountCents: number;
  paymentMethod: string;
  description: string;
  idempotencyKey?: string;
}): Promise<Charge> {
  const s = state();
  if (s.failNext > 0) {
    s.failNext -= 1;
    throw new Error("PayDemo API error: 503 Service Unavailable");
  }
  if (params.idempotencyKey) {
    const previous = s.charges.find((c) => c.idempotencyKey === params.idempotencyKey);
    if (previous) return previous;
  }
  s.seq += 1;
  const created: Charge = { id: `ch_sim_${s.seq}`, createdAt: new Date().toISOString(), ...params };
  s.charges.push(created);
  return created;
}

// --- simulator controls (demo and tests only) ---
export function listCharges(): Charge[] {
  return [...state().charges];
}
export function failNextCharges(n: number) {
  state().failNext = n;
}
export function resetProvider() {
  g.__paydemo = { charges: [], failNext: 0, seq: 0 };
}
