import path from "node:path";

/** Where to save a screenshot, or undefined when SCREENSHOTS_DIR is not set. SHOT_PREFIX names the version. */
export function shotPath(name: string): string | undefined {
  const dir = process.env.SCREENSHOTS_DIR;
  return dir ? path.join(dir, `${process.env.SHOT_PREFIX ?? ""}${name}`) : undefined;
}
