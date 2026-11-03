-- Store emails lower-case. If two accounts already share an email, the index below
-- fails on purpose: merge those accounts first (see report/findings.md, finding 4).
UPDATE "users" SET "email" = lower(trim("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));