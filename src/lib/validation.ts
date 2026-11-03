import { z } from "zod";

export const SignupInput = z.object({
  email: z.email().max(254),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  name: z.string().trim().max(100).optional(),
});

export const LoginInput = z.object({
  email: z.string().max(254),
  password: z.string().max(200),
});

// Unknown keys (priceCents, status, userId...) are dropped: the server decides those.
export const BookingInput = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.iso.date(), // YYYY-MM-DD, a real calendar date
  time: z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, "Use HH:MM in 15-minute steps"),
  notes: z.string().trim().max(1000).optional(),
});

/** Parses a JSON body; on failure returns a 400 that names each bad field. */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S>; error?: never } | { data?: never; error: Response }> {
  const raw = await req.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const { formErrors, fieldErrors } = z.flattenError(result.error);
    return { error: Response.json({ error: "Invalid input", formErrors, fieldErrors }, { status: 400 }) };
  }
  return { data: result.data };
}

// A PayDemo webhook event, checked after its signature. Every event has an id and
// a type; other types are accepted and ignored.
export const PayDemoEvent = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
});

// A checkout.completed event must say which booking it is for.
export const CheckoutCompletedEvent = PayDemoEvent.extend({
  type: z.literal("checkout.completed"),
  data: z.object({
    bookingId: z.coerce.number().int().positive(),
    paymentMethod: z.string().min(1).max(200),
  }),
});
