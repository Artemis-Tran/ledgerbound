import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { charactersNamedIn, firstSentence, loreNamedIn, normalName } from "../src/entries.ts";
import { loadProject, type Project } from "../src/project.ts";
import { FIXTURE, edit, fixtureCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");

function load(dir = FIXTURE): Project {
  const { project, issues } = loadProject(dir);
  if (!project) throw new Error(JSON.stringify(issues));
  return project;
}

describe("lore names", () => {
  test("a name has no leading article and is in lower case", () => {
    expect(normalName("The Counting House")).toBe("counting house");
    expect(normalName("An old well")).toBe("old well");
    expect(normalName("Theodric's gate")).toBe("theodric's gate");
  });

  test("a text names an entry in any case, with or without 'the', singular or plural", () => {
    const project = load();
    expect(loreNamedIn(project, "He signed at the Counting House.")).toEqual(["counting-house"]);
    expect(loreNamedIn(project, "Two counting houses stood empty.")).toEqual(["counting-house"]);
    expect(loreNamedIn(project, "No delving crew would take him.")).toEqual(["delving-crews"]);
    expect(loreNamedIn(project, "the counting-house clerks")).toEqual(["counting-house"]);
  });

  test("a name inside a longer word is not a match", () => {
    const project = load();
    expect(loreNamedIn(project, "The harvester, the tithe bellows, a crew bossman.")).toEqual([]);
  });

  test("a text names a character by its name, an alias, or a capitalized part of its name", () => {
    const project = load();
    expect(charactersNamedIn(project, "Sabine Rook wrote.")).toEqual(["sabine"]);
    expect(charactersNamedIn(project, "Rook said nothing.")).toEqual(["sabine"]);
    expect(charactersNamedIn(project, "He went to find the warden.")).toEqual(["hale"]);
    expect(charactersNamedIn(project, "A rook sat on the rope, and nobody watched.")).toEqual([]);
  });

  test("the first sentence of an entry, cut when it is long", () => {
    expect(firstSentence("A bell hangs in the shaft. It rings.\n\nMore.")).toBe("A bell hangs in the shaft.");
    expect(firstSentence("x".repeat(200), 20)).toBe(`${"x".repeat(19)}…`);
  });
});

describe("lb lore", () => {
  test("lists the entries that a chapter names", () => {
    const r = spawnSync("node", [CLI, "lore", "books/01/chapters/01.md", "--json"], { cwd: FIXTURE, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).entries.map((e: { id: string }) => e.id)).toEqual(["harvest-day", "tithe-bell"]);
  });

  test("gives each entry as it is at the start of the chapter", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/chapters/01.md", "Sabine Rook had the ledger open", "The old gallery was quiet. Sabine Rook had the ledger open");
    const r = spawnSync("node", [CLI, "lore", "books/01/chapters/01.md", "--json"], { cwd: dir, encoding: "utf8" });
    const gallery = JSON.parse(r.stdout).entries.find((e: { id: string }) => e.id === "old-gallery");
    expect(gallery.text).toContain("forty fathoms down");
    expect(gallery.text).not.toContain("The roof has come down");
  });

  test("gives one entry at a point with --at", () => {
    const at = (p: string) => spawnSync("node", [CLI, "lore", "old-gallery", "--at", p, "--json"], { cwd: FIXTURE, encoding: "utf8" });
    expect(JSON.parse(at("1.04").stdout).text).not.toContain("Changes");
    expect(JSON.parse(at("1.05").stdout).text).toContain("- Since 1.04 (b1/act2/end): The roof has come down");
    expect(spawnSync("node", [CLI, "lore", "old-gallery"], { cwd: FIXTURE, encoding: "utf8" }).status).toBe(2);
  });

  test("an entry that the frontmatter only names is not listed", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/chapters/01.md", "title: Level Three", "title: The Counting House");
    const r = spawnSync("node", [CLI, "lore", "books/01/chapters/01.md", "--json"], { cwd: dir, encoding: "utf8" });
    expect(JSON.parse(r.stdout).entries.map((e: { id: string }) => e.id)).not.toContain("counting-house");
  });
});

describe("lb who", () => {
  const who = (args: string[]) => spawnSync("node", [CLI, "who", ...args], { cwd: FIXTURE, encoding: "utf8" });

  test("gives a character at the start of a chapter: who it is, its voice card, its record and when it was last seen", () => {
    const r = JSON.parse(who(["sabine", "--at", "1.02", "--json"]).stdout);
    expect(r).toMatchObject({ id: "sabine", name: "Sabine Rook", role: "main", file: "characters/sabine.md", last_seen: "1.01", record: { level: 4, rank: "copper" } });
    expect(r.text).toContain("The reeve's clerk");
    expect(r.voice.verbal_habits).toEqual(["Corrects other people's numbers"]);
    expect(JSON.parse(who(["hale", "--at", "1.01", "--json"]).stdout).last_seen).toBeNull();
  });

  test("gives an entity with no character file, and fails on an unknown ID or with no --at", () => {
    const dir = fixtureCopy();
    edit(dir, "schema.yaml", "  tithe-well:", "  pell:\n    type: person\n    name: Oren Pell\n  tithe-well:");
    const r = JSON.parse(spawnSync("node", [CLI, "who", "pell", "--at", "1.02", "--json"], { cwd: dir, encoding: "utf8" }).stdout);
    expect(r).toMatchObject({ name: "Oren Pell", file: null, voice: null });
    expect(who(["nobody", "--at", "1.02"]).status).toBe(2);
    expect(who(["sabine"]).status).toBe(2);
  });

  test("lists the characters that a chapter names", () => {
    const r = JSON.parse(who(["books/01/chapters/01.md", "--json"]).stdout);
    expect(r.characters.map((c: { id: string }) => c.id)).toEqual(["ivo", "sabine"]);
    expect(r.characters[0].last_seen).toBeNull();
  });
});
