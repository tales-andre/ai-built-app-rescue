import "server-only";

/** Reads a server-side secret. Demo default in development and tests; required in production. */
export function serverSecret(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production" && !process.env.DEMO_DEFAULTS) {
    throw new Error(`${name} is not set`);
  }
  return devDefault;
}
