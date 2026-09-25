import { parseDocument } from "yaml";

export interface Frontmatter {
  data: unknown;
  body: string;
  /** Number of lines before the body starts, so body line N is file line N + bodyOffset. */
  bodyOffset: number;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(text: string): Frontmatter {
  const m = FENCE.exec(text);
  if (!m) return { data: undefined, body: text, bodyOffset: 0 };
  const doc = parseDocument(m[1]);
  if (doc.errors.length > 0) throw new Error(`frontmatter YAML: ${doc.errors[0].message}`);
  return { data: doc.toJS(), body: text.slice(m[0].length), bodyOffset: m[0].split("\n").length - 1 };
}

/**
 * Sets one top-level scalar frontmatter key and changes no other line, so the author's
 * formatting stays as it is.
 */
export function setFrontmatterKey(text: string, key: string, value: string): string {
  const line = `${key}: ${value}`;
  const m = FENCE.exec(text);
  if (!m) return `---\n${line}\n---\n${text}`;
  const keyRe = new RegExp(`^${key}:.*$`, "m");
  const yaml = keyRe.test(m[1]) ? m[1].replace(keyRe, line) : `${line}\n${m[1]}`;
  return `---\n${yaml}\n---\n${text.slice(m[0].length)}`;
}
