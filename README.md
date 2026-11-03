# Brightside Salons booking app: "before" version (do not deploy)

**This is the intentionally flawed version of an open-source demo.** Brightside Salons is a
fictional company. The code at this tag was written on purpose with mistakes that AI-generated
code often ships with (a secret key in the browser bundle, an API that trusts the user ID it is
sent, a payment webhook that can charge twice, and more).

The review, the fixes (one commit each) and the tests are on the `main` branch.

```bash
npm install
cp .env.example .env.local
npm run dev
```
