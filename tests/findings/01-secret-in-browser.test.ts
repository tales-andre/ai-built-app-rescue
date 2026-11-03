// Finding 1: the payment provider's secret key ships to every visitor's browser.
// Static checks over the source. The e2e suite also greps the production bundle
// (e2e/bundle.spec.ts), which is the stronger proof.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = walk(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
const rel = (f: string) => path.relative(ROOT, f).replaceAll("\\", "/");
const isClient = (src: string) => /^\s*["']use client["']/.test(src);

// Anything prefixed NEXT_PUBLIC_ is copied into the browser bundle at build time.
const SECRET_PUBLIC_VAR = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE|PASSWORD|SERVICE_ROLE|WEBHOOK)[A-Z0-9_]*/g;

describe("Finding 1: the payment secret key is shipped to the browser", () => {
  it("no secret is exposed through a NEXT_PUBLIC_ variable (source and .env.example)", () => {
    const hits: string[] = [];
    for (const file of [...sourceFiles, path.join(ROOT, ".env.example")]) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(SECRET_PUBLIC_VAR)) hits.push(`${rel(file)}: ${m[0]}`);
    }
    expect(hits).toEqual([]);
  });

  it("browser code does not import server modules that hold secrets", () => {
    const hits: string[] = [];
    for (const file of sourceFiles) {
      const src = readFileSync(file, "utf8");
      if (!isClient(src)) continue;
      for (const m of src.matchAll(/from\s+["'](@\/db[^"']*|@\/lib\/(paydemo|session|payments)[^"']*)["']/g)) {
        hits.push(`${rel(file)} imports ${m[1]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("modules that hold secrets are marked server-only, so a future client import fails the build", () => {
    for (const file of ["src/lib/paydemo.ts", "src/lib/session.ts", "src/db/index.ts"]) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).toMatch(/^import ["']server-only["'];/m);
    }
  });
});
