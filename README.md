# ai-built-app-rescue

A demo app with the mistakes AI-generated code often ships with, reviewed and fixed for
production: before and after, with tests.

> Need this on your own app? Fixed-scope review and fix on Upwork: https://www.upwork.com/services/product/2117770893902192528.


![Demo: the same tests fail on the original code and pass after the fixes](docs/demo.gif)

**A common request on freelance job boards:** *the app was put together mostly with an AI coding
agent, it works in the demo, and now it has to take real customers and real payments. Can someone
check what is wrong, fix it, and show that it is fixed?*

This repo shows how I answer that, on an **open-source demo** with a **fictional company**:
Brightside Salons, a salon chain with an online booking app (Next.js, TypeScript, Postgres). The
original version was written **on purpose** with mistakes that AI-generated code often ships with.
It is not a client's code.

- **Before:** tag [`vibe-coded`](https://github.com/tales-andre/ai-built-app-rescue/tree/vibe-coded). Do not deploy it.
- **After:** branch `main`. Each problem is fixed in its own commit, and each has a test that fails
  on the tag and passes on `main`.
- **Report for the owner:** [`report/findings.md`](report/findings.md) ([PDF](report/findings.pdf)),
  ranked by risk, written as "what could happen to your business", with a section for the
  developer and a list of what I did not fix and why.
- **Findings page:** [`docs/index.html`](docs/index.html), one card per problem with the risk, the
  test results before and after, and the diff of the fix. Ready for GitHub Pages.

![Finding card: other customers' bookings](docs/card-other-customers.png)

Finding 2 in the app itself, before and after:

![Before: Alice sees Bob's booking and private note. After: only her own booking](docs/idor-before-after.png)

## What it shows

| Risk | What could happen to the business | Test |
|---|---|---|
| Critical | The payment account's secret key is visible to every visitor | [`01`](tests/findings/01-secret-in-browser.test.ts), [`e2e`](e2e/bundle.spec.ts) |
| Critical | Anyone logged in could see and cancel other customers' bookings | [`02`](tests/findings/02-other-customers-bookings.test.ts), [`e2e`](e2e/other-customers-bookings.spec.ts) |
| Critical | A fake payment message could charge cards; a repeated one charged twice | [`03`](tests/findings/03-payment-webhook.test.ts) |
| High | Appointments were saved at the wrong time (server time zone, not the salon's) | [`05`](tests/findings/05-time-zone.test.ts) |
| High | Customers could set their own price; bad input crashed the request | [`06`](tests/findings/06-input-validation.test.ts) |
| High | Unlimited password guessing | [`07`](tests/findings/07-login-rate-limit.test.ts) |
| Medium | Errors were hidden: the build ignored type errors (one was a real bug) and the webhook swallowed failures | [`08`](tests/findings/08-hidden-errors.test.ts) |
| Medium | One person could end up with two accounts (sign-up race, letter case) | [`04`](tests/findings/04-duplicate-signup.test.ts) |

Found while fixing: the session signing key had a hard-coded fallback, and the session cookie was
not marked Secure ([`tests/session.test.ts`](tests/session.test.ts)).

Not covered here: Supabase Row Level Security. For that, see
[supabase-rls-tenant-audit](https://github.com/tales-andre/supabase-rls-tenant-audit).

```text
$ git log --oneline vibe-coded..main
Fix 1: keep the payment secret key on the server
Fix 2: take the customer from the session, not from the request
Fix 3: verify webhook signatures and charge each deposit once
Fix 4: one account per email, enforced by the database
Fix 5: read appointment times in the salon's time zone
Fix 6: validate every request body and let the server set prices
Fix 7: pause login after repeated wrong passwords
Fix 8: stop hiding errors
...
Fix 7, follow-up: count each login attempt before the password check
Fix 3, follow-up: validate webhook events and test each layer on its own
...
```

(The full log also has the commit that adds the tests, the end-to-end tests, the evidence and the
docs. The two follow-ups came from a second review: the first login fix could be passed by
sending guesses in parallel, and the first webhook tests did not prove each layer on its own.)

## Run it

Requirements: Node.js 22. No Docker, no cloud account and no API key: the database is an embedded
Postgres (PGlite) and the payment provider, "PayDemo", is fictional and simulated inside the app.

```bash
npm ci
cp .env.example .env.local     # demo values only
npm run dev                    # http://localhost:3000: sign up, book, pay the deposit
```

| Booking form | After paying the deposit |
|---|---|
| ![Booking form](docs/screenshots/app-book.png) | ![Booking confirmed](docs/screenshots/app-bookings.png) |

Tests:

```bash
npm run typecheck        # src/, tests/, e2e/ and the config files (scripts/ is plain JavaScript)
npm test                 # fixed code: every test passes
npm run test:before      # the same tests against tag vibe-coded: the finding tests fail
npm run test:e2e         # production build + Playwright (Edge on Windows, Chromium elsewhere)
```

The screenshots come from the Playwright tests: `SCREENSHOTS_DIR=docs/screenshots npx playwright test`
after a build, or `npm run evidence`, which also takes the "before" one from the tag.

Expected end of `npm test`:

```text
 Test Files  10 passed (10)
      Tests  42 passed (42)
```

Expected end of `npm run test:before`:

```text
 Test Files  9 failed | 1 passed (10)
      Tests  34 failed | 8 passed (42)
```

The 8 that pass on the original code are the normal-use tests (log in, book, cancel your own
booking, pay a deposit) and four checks the original already met, such as "Bob can still cancel
his own booking" and "a couple of typos followed by the right password still logs in". Full output: [`docs/evidence/before.txt`](docs/evidence/before.txt),
[`after.txt`](docs/evidence/after.txt), [`e2e-before.txt`](docs/evidence/e2e-before.txt),
[`e2e-after.txt`](docs/evidence/e2e-after.txt).

**Optional, a real Postgres server** instead of the embedded one:

```bash
docker compose up -d
echo "DATABASE_URL=postgres://postgres:postgres@localhost:54330/brightside" >> .env.local
npm run dev
npm run test:pg      # the same suite against that server, one file at a time
```

**Regenerate the evidence, the findings page, the GIF and the PDF:**

```bash
npm run evidence     # unit and e2e tests on both versions: docs/evidence/ and docs/screenshots/
npm run docs:build   # docs/index.html, the cards, docs/idor-before-after.png, docs/demo.gif
npm run report:pdf   # report/findings.pdf
```

## How it works

```mermaid
flowchart LR
  subgraph suite["One test suite"]
    T["tests/findings/*.test.ts<br/>one file per problem"]
    N["tests/app.test.ts<br/>normal use"]
  end
  suite -- "npm run test:before<br/>(git worktree of the tag)" --> B["tag vibe-coded<br/>(before)"]
  suite -- "npm test" --> A["branch main<br/>(Fix 1 to Fix 8)"]
  B --> R1["finding tests fail:<br/>the problems are real"]
  A --> R2["every test passes:<br/>fixed, normal use intact"]
```

- The tests call the real Next.js route handlers, against a real Postgres engine (PGlite runs
  Postgres compiled to WebAssembly), with only the interfaces both versions share. That is what
  lets one suite run against both.
- `scripts/test-before.mjs` checks the tag out into `.before/` with `git worktree`, copies the
  current `tests/` in, runs them there and removes the worktree at the end. `.before/node_modules`
  is a link to the main `node_modules`: do not delete `.before/` with `git worktree remove` by
  hand (it follows the link); use `node scripts/before-worktree.mjs --remove`.
- Payments: the browser asks the app's server for a checkout; the server calls the PayDemo
  simulator with the secret key; the simulator sends a signed `checkout.completed` webhook back;
  the webhook charges the deposit once and confirms the booking.

```mermaid
sequenceDiagram
  participant B as Browser
  participant S as App server
  participant P as PayDemo (simulated)
  B->>S: POST /api/checkout (session cookie)
  S->>P: create checkout (secret key, server only)
  P->>S: POST /api/payments/webhook (HMAC signature)
  S->>S: verify signature, record event id, lock booking
  S->>P: charge deposit (idempotency key)
  S-->>B: booking confirmed
```

## Design decisions and trade-offs

- **Fix in place, keep the stack.** The point of a rescue is to make the existing app safe, not to
  rewrite it. Each commit is small enough to review on its own.
- **Tests first, against both versions.** A test that only exists after the fix proves little; the
  same test failing on the original is the evidence that the problem was real.
- **Embedded Postgres (PGlite) by default.** Runs anywhere with `npm ci`, and the tests exercise
  real SQL: the unique index, the login attempts table, the transactions in the webhook and the
  login. `DATABASE_URL` switches to a regular Postgres server.
- **A small signed-cookie session** instead of an auth library, so the tests need no framework
  mocks. A real project would usually use Auth.js or the platform's auth; the findings (trusting
  the client, no rate limit) apply the same way.
- **The webhook has three layers, not one:** the event id table (provider retries), the booking
  status checked under a row lock (two checkouts for one booking, or a cancelled booking), and the
  provider's idempotency key (the provider charged but its answer was lost). What the tests prove:
  with the idempotency key switched off on the simulated provider, the status check alone still
  charges once, in sequence and at the same moment, and skips a cancelled booking; with the
  provider's answer lost after charging, the key alone stops the retry from charging again. Not
  proven by a test: the event id table (for this app's only event type, the status check also
  stops a repeat) and the row lock (see Limits).
- **The login limit counts the attempt before checking the password**, in one transaction under
  a per-account advisory lock. Thirty guesses sent at the same moment get five answers of "wrong
  password" and twenty-five of "paused".

## Limits

- PayDemo is a fictional provider and its simulator lives in this repo. The webhook pattern
  (signature over timestamp and raw body, event dedup, idempotency key) matches what real payment
  providers document, but no real provider is called.
- The login limit counts per account and lives in the database; an IP limit belongs in front of
  the app. See "What I did not fix" in the [report](report/findings.md#what-i-did-not-fix-and-why).
- The original app is small (about a dozen routes) and its mistakes were planted on purpose. A real
  review starts by mapping the app and agreeing on what "production" means for the owner, which
  takes longer than running these tests.
- Tested on Windows 11 with Node.js 22 (unit and e2e, Microsoft Edge). The GitHub Actions workflow
  runs the same suite on Ubuntu with Chromium on every push and pull request: the fixed code must
  pass, the finding tests must fail on the `vibe-coded` tag, and the end-to-end tests run on the
  production build.
- The screenshots and the evidence files use the embedded PGlite engine, which runs one
  transaction at a time, so on PGlite the parallel tests cannot catch a missing row lock (webhook)
  or advisory lock (login). On 2026-11-05 the suite was also run against PostgreSQL 16 in Docker
  (`npm run test:pg`: node-postgres pool, up to 10 connections, files in sequence): 10 files,
  42 tests passed, including the 30 simultaneous logins, the two checkouts at the same moment and
  the parallel signups. That shows the fixed version holds under real concurrency; it does not
  show that removing a lock would make a test fail, which is the next experiment.
- The session cookie is `Secure` in production. Browsers accept that on `http://localhost`, so
  `npm start` works on your machine; on any other host, serve the app over HTTPS.
- `npm audit` reports a moderate advisory in `drizzle-kit` (a development tool, through an old
  `esbuild`). It is not part of the running app.

## Repo map

| Path | What |
|---|---|
| `src/app/api/**` | Route handlers: auth, bookings, checkout, payment webhook, PayDemo simulator |
| `src/lib/` | Session, time zone, validation, login limit, webhook signature, PayDemo client |
| `src/db/` | Drizzle schema and database setup (PGlite or `DATABASE_URL`) |
| `drizzle/` | SQL migrations |
| `tests/findings/` | One test file per finding, run before and after |
| `tests/app.test.ts` | Normal use, must pass on both versions |
| `e2e/` | Playwright tests on the production build |
| `report/` | Owner report (Markdown, PDF) and `findings.json` |
| `docs/` | Findings page, GIF, screenshots, raw test output in `docs/evidence/` |
| `scripts/` | Run the tests on the tag, collect evidence, build the page, GIF and PDF |

## License

MIT. See [LICENSE](LICENSE).
