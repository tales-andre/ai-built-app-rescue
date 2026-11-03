// Test harness: calls the real Next.js route handlers with real Request objects
// against an in-memory Postgres (PGlite), emptied before every test. Only uses
// interfaces that exist in both the "before" (tag vibe-coded) and "after" (main)
// versions, so the same suite can run against both.
import { createHmac, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createDb, DEFAULT_SERVICES, setDb, type Db } from "@/db";
import { bookings, services, users } from "@/db/schema";
import { resetProvider } from "@/lib/paydemo";
import * as signupRoute from "@/app/api/auth/signup/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import * as cancelRoute from "@/app/api/bookings/[id]/cancel/route";
import * as webhookRoute from "@/app/api/payments/webhook/route";

const BASE = "http://brightside.test";
export const PASSWORD = "correct horse battery staple";

let db: Db | undefined;

/**
 * One in-memory database per test file (creating one takes a few seconds);
 * every table is emptied and the service list re-seeded before each test.
 */
export async function freshApp(): Promise<Db> {
  if (!db) {
    db = await createDb(); // no dataDir: in-memory
  } else {
    const { rows } = await db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
    await db.execute(sql.raw(`truncate ${tables} restart identity cascade`));
    await db.insert(services).values(DEFAULT_SERVICES);
  }
  setDb(db);
  resetProvider();
  return db;
}

type Handler = (req: Request, ctx?: any) => Promise<Response> | Response;

/** Like Next.js: an exception thrown by a route handler becomes a 500 response. */
async function invoke(handler: Handler, req: Request, ctx?: unknown): Promise<Response> {
  try {
    return await handler(req, ctx);
  } catch (err) {
    return Response.json({ thrown: String(err) }, { status: 500 });
  }
}

function jsonRequest(path: string, body: unknown, init: { cookie?: string; method?: string; headers?: Record<string, string> } = {}) {
  return new Request(BASE + path, {
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.7",
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...init.headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

export type TestUser = { id: number; email: string; cookie: string };

export async function signupRaw(email: string, password = PASSWORD, name = "Test") {
  return invoke(signupRoute.POST, jsonRequest("/api/auth/signup", { email, password, name }));
}

export async function signup(email: string, name = "Test"): Promise<TestUser> {
  const res = await signupRaw(email, PASSWORD, name);
  if (!res.ok) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { id: json.user.id, email, cookie: cookieFrom(res) };
}

export async function login(email: string, password: string) {
  return invoke(loginRoute.POST, jsonRequest("/api/auth/login", { email, password }));
}

/** Sends what the app's own front end sends: the session cookie and the user id. */
export async function createBookingRaw(user: TestUser | null, body: Record<string, unknown>) {
  return invoke(
    bookingsRoute.POST,
    jsonRequest("/api/bookings", { userId: user?.id, ...body }, { cookie: user?.cookie }),
  );
}

export async function createBooking(user: TestUser, body: Record<string, unknown> = {}) {
  const res = await createBookingRaw(user, { serviceId: 1, date: "2026-11-10", time: "10:00", ...body });
  if (res.status !== 201) throw new Error(`booking failed: ${res.status} ${await res.text()}`);
  return (await res.json()).booking as { id: number };
}

export async function listBookings(user: TestUser | null, query: { userId?: number } = {}) {
  const qs = query.userId === undefined ? "" : `?userId=${query.userId}`;
  return invoke(
    bookingsRoute.GET,
    new Request(`${BASE}/api/bookings${qs}`, { headers: user ? { cookie: user.cookie } : {} }),
  );
}

export async function cancelBooking(user: TestUser | null, bookingId: number, body: Record<string, unknown> = {}) {
  return invoke(
    cancelRoute.POST,
    jsonRequest(`/api/bookings/${bookingId}/cancel`, { userId: user?.id, ...body }, { cookie: user?.cookie }),
    { params: Promise.resolve({ id: String(bookingId) }) },
  );
}

export function checkoutEvent(bookingId: number, id = `evt_test_${randomBytes(4).toString("hex")}`) {
  return { id, type: "checkout.completed", data: { bookingId, paymentMethod: "pm_test_visa" } };
}

/** PayDemo signature: header `paydemo-signature: t=<unix>,v1=<hex HMAC-SHA256("t.body")>`. */
export function signPayload(body: string, opts: { secret?: string; t?: number } = {}) {
  const t = opts.t ?? Math.floor(Date.now() / 1000);
  const secret = opts.secret ?? process.env.PAYDEMO_WEBHOOK_SECRET!;
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export async function deliverWebhook(event: unknown, opts: { signature?: string | null } = {}) {
  const body = JSON.stringify(event);
  const signature = opts.signature === undefined ? signPayload(body) : opts.signature;
  return invoke(
    webhookRoute.POST,
    jsonRequest("/api/payments/webhook", body, { headers: signature ? { "paydemo-signature": signature } : {} }),
  );
}

export async function getBooking(id: number) {
  const [row] = await db!.select().from(bookings).where(eq(bookings.id, id));
  return row;
}

export async function allUsers() {
  return db!.select().from(users);
}
