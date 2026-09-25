export type Severity = "error" | "warn";

/** One problem that the validator found in a novel repo. */
export interface Issue {
  code: string;
  severity: Severity;
  file: string;
  /** Dotted path inside the file, for example `acts.1.ending_state`. */
  path?: string;
  message: string;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === "error");

export function formatIssues(issues: Issue[]): string {
  if (issues.length === 0) return "OK: no issues.";
  return issues
    .map((i) => `${i.severity.toUpperCase()} ${i.code} ${i.file}${i.path ? `#${i.path}` : ""}: ${i.message}`)
    .join("\n");
}
