import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(), // stored lower-case
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // The database, not the app, guarantees one account per email.
  (t) => [uniqueIndex("users_email_lower_unique").on(sql`lower(${t.email})`)],
);

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  durationMin: integer("duration_min").notNull(),
  priceCents: integer("price_cents").notNull(),
  depositCents: integer("deposit_cents").notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  serviceId: integer("service_id")
    .notNull()
    .references(() => services.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
  priceCents: integer("price_cents").notNull(),
  status: text("status").notNull().default("pending_deposit"),
  depositChargeId: text("deposit_charge_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Webhook events already handled, so a retried delivery is a no-op.
export const processedEvents = pgTable("processed_events", {
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

// Login attempts per account, used to pause password guessing.
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    ip: text("ip"),
    succeeded: boolean("succeeded").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_email_created_idx").on(t.email, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
