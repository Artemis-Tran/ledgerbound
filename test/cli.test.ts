import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { edit, fixtureCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const lb = (args: string[], cwd?: string) => spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });

describe("lb", () => {
  test("validate exits 0 on the fixture and 1 on an error", () => {
    const dir = fixtureCopy();
    expect(lb(["validate", "--dir", dir]).status).toBe(0);
    edit(dir, "books/01/plan/02.md", "type: reveal", "type: decision");
    const r = lb(["validate", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).issues).toContainEqual(expect.objectContaining({ code: "endings.type-repeat" }));
  });

  test("gate and approve", () => {
    const dir = fixtureCopy();
    edit(dir, "voice/action.md", "status: approved", "status: draft");
    expect(lb(["gate", "voice-sample"], dir).status).toBe(1);
    expect(lb(["approve", "voice-sample"], dir).status).toBe(0);
    expect(lb(["gate", "voice-sample"], dir).status).toBe(0);
  });

  test("lint exits 1 on an error, and waives what the chapter plan allows", () => {
    const dir = fixtureCopy();
    const chapters = join(dir, "books/01/chapters");
    spawnSync("mkdir", ["-p", chapters]);
    writeFileSync(join(chapters, "05.md"), "It was cold. It was dark. It was late.\n\nThe cart went up the manor road under the Duke's seal.\n");
    const five = lb(["lint", "--json", join(chapters, "05.md")], dir);
    expect(five.status).toBe(0);
    expect(JSON.parse(five.stdout).results[0].findings[0]).toMatchObject({ rule: "rhythm.staccato", waived: true });

    writeFileSync(join(chapters, "04.md"), "It was cold. It was dark. It was late.\n\nThe roof came down between Ivo and the shaft.\n");
    expect(lb(["lint", join(chapters, "04.md")], dir).status).toBe(1);
  });

  test("lint compares a voice sample with the other two", () => {
    const dir = fixtureCopy();
    edit(dir, "voice/quiet.md", "blew out the lamp.", "blew out the lamp. The slate held him on both sides like a closing hand.");
    const r = JSON.parse(lb(["lint", "--json", join(dir, "voice/quiet.md")]).stdout);
    expect(r.results[0].findings).toContainEqual(expect.objectContaining({ rule: "repetition.simile", seeAlso: [expect.objectContaining({ file: "voice/action.md" })] }));
  });

  test("init makes a novel repo that asks for start-project", () => {
    const dir = mkdtempSync(join(tmpdir(), "lb-cli-"));
    expect(lb(["init", dir, "--title", "Ash Road", "--format", "standalone"]).status).toBe(0);
    for (const f of ["project.yaml", "CLAUDE.md", "guidelines/writing.md", "threads.yaml"]) expect(existsSync(join(dir, f))).toBe(true);
    expect(lb(["status"], dir).stdout).toContain("start-project");
  });

  test("an unknown checkpoint is a usage error", () => {
    expect(lb(["gate", "outline"], fixtureCopy()).status).toBe(2);
  });
});
