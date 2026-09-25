import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Makes a novel repo in `dir` from templates/. It does not overwrite a file that exists. */
export function initProject(dir: string, title: string, format: "series" | "standalone"): string[] {
  const created: string[] = [];
  const templates = join(TOOL_ROOT, "templates");
  const vars: Record<string, string> = { TITLE: JSON.stringify(title), FORMAT: format };

  const walk = (rel: string) => {
    for (const entry of readdirSync(join(templates, rel), { withFileTypes: true })) {
      const r = join(rel, entry.name);
      if (entry.isDirectory()) walk(r);
      else {
        const target = join(dir, r);
        if (existsSync(target)) continue;
        mkdirSync(dirname(target), { recursive: true });
        const text = readFileSync(join(templates, r), "utf8").replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
        writeFileSync(target, text);
        created.push(r);
      }
    }
  };
  walk("");

  const guidelines = join(dir, "guidelines", "writing.md");
  if (!existsSync(guidelines)) {
    mkdirSync(dirname(guidelines), { recursive: true });
    copyFileSync(join(TOOL_ROOT, "guidelines", "writing.md"), guidelines);
    created.push("guidelines/writing.md");
  }
  return created;
}
