import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, statSync, existsSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { QueryStore, StoreError } from "../../server/store.js";

let dir: string;
let store: QueryStore;

function put(rel: string, content = "select 1") {
  const p = path.join(dir, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
}

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof StoreError ? e.code : String(e);
  }
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "store-"));
  store = new QueryStore(dir);
});

describe("QueryStore.tree", () => {
  it("lists existing flat files untouched", async () => {
    put("Show_Nodes.sql");
    put("Campus_Operators_-_All_IT.CALL_devices.sql");
    put(".DS_Store", "x");
    put(".logs/2026-11.jsonl", "{}");
    const before = statSync(path.join(dir, "Show_Nodes.sql")).mtimeMs;
    const tree = await store.tree();
    expect(tree.map((n) => n.path)).toEqual(["Campus_Operators_-_All_IT.CALL_devices", "Show_Nodes"]);
    expect(tree.every((n) => n.type === "query")).toBe(true);
    expect(statSync(path.join(dir, "Show_Nodes.sql")).mtimeMs).toBe(before);
  });

  it("lists uppercase .SQL and nested folders, folders first", async () => {
    put("A/b.SQL");
    put("z.sql");
    const tree = await store.tree();
    expect(tree[0]).toMatchObject({ type: "folder", name: "A", path: "A" });
    expect(tree[0].children![0]).toMatchObject({ type: "query", name: "b", path: "A/b" });
    expect(tree[1]).toMatchObject({ type: "query", path: "z" });
  });

  it("description parsed", async () => {
    put("p.sql", "-- description: Phones in a pool\nSELECT 1");
    expect((await store.tree())[0].description).toBe("Phones in a pool");
  });

  it("ignores non-sql files", async () => {
    put("notes.txt", "x");
    expect(await store.tree()).toEqual([]);
  });
});

describe("hand-made names with spaces and special characters", () => {
  it("opens, renames and deletes a file whose name has spaces", async () => {
    put("My Report.sql", "R");
    put("My Folder/q.sql", "Q");
    expect((await store.tree()).map((n) => n.path)).toEqual(["My Folder", "My Report"]);
    expect(await store.read("My Report")).toBe("R");
    expect(await store.read("My Folder/q")).toBe("Q");
    await store.move("My Report", "Renamed");
    expect(await store.read("Renamed")).toBe("R");
    expect(Object.keys((await store.remove("My Folder")).deletedSql)).toEqual(["My Folder/q"]);
  });

  it("still finds a file by its sanitized name (old links)", async () => {
    put("My_Folder/q.sql", "x");
    expect(await store.read("My Folder/q")).toBe("x");
  });

  it("overwriting an existing name with spaces keeps the same file", async () => {
    put("My Report.sql", "old");
    expect(await store.write("My Report", "new")).toBe("My Report");
    expect(readFileSync(path.join(dir, "My Report.sql"), "utf8")).toBe("new");
    expect(existsSync(path.join(dir, "My_Report.sql"))).toBe(false);
  });

  it("new names are sanitized", async () => {
    expect(await store.write("New Folder/a b", "x")).toBe("New_Folder/a_b");
  });

  it("rejects a .sql symlink that points outside the data dir", async () => {
    const outside = mkdtempSync(path.join(tmpdir(), "outside-"));
    writeFileSync(path.join(outside, "secret"), "select secret");
    symlinkSync(path.join(outside, "secret"), path.join(dir, "leak.sql"));
    expect(await code(store.read("leak"))).toBe("invalid");
    expect(await code(store.write("leak", "x"))).toBe("invalid");
    expect(readFileSync(path.join(outside, "secret"), "utf8")).toBe("select secret");
  });
});

describe("QueryStore.read/write", () => {
  it("read strips BOM and preserves CRLF", async () => {
    put("q.sql", "﻿SELECT 1\r\nFROM x");
    expect(await store.read("q")).toBe("SELECT 1\r\nFROM x");
  });

  it("reads uppercase extension", async () => {
    put("A/b.SQL", "select 2");
    expect(await store.read("A/b")).toBe("select 2");
  });

  it("write creates parent dirs and overwrites", async () => {
    await store.write("New/Deep/q", "select 1");
    await store.write("New/Deep/q", "select 2");
    expect(readFileSync(path.join(dir, "New/Deep/q.sql"), "utf8")).toBe("select 2");
  });

  it("write overwrites an existing uppercase-extension file instead of adding a twin", async () => {
    put("A/b.SQL", "old");
    await store.write("A/b", "new");
    expect(readFileSync(path.join(dir, "A/b.SQL"), "utf8")).toBe("new");
    expect(existsSync(path.join(dir, "A/b.sql"))).toBe(false);
  });

  it("write with create flag refuses an existing query", async () => {
    put("a.sql", "A");
    expect(await code(store.write("a", "B", { create: true }))).toBe("exists");
    expect(await store.read("a")).toBe("A");
  });

  it("not_found on missing read", async () => {
    expect(await code(store.read("nope"))).toBe("not_found");
  });
});

describe("QueryStore.sanitizePath", () => {
  it("sanitizes segments", () => {
    expect(store.sanitizePath("My Folder/a b?c")).toBe("My_Folder/a_b_c");
  });

  it("strips a trailing .sql", () => {
    expect(store.sanitizePath("x/y.sql")).toBe("x/y");
  });

  it.each(["../etc/passwd", "/abs", "a/../../x", "", "a//b", ".hidden/x"])("rejects %s", (p) => {
    expect(() => store.sanitizePath(p)).toThrow(StoreError);
  });

  it("rejects symlink escaping data dir on read", async () => {
    const outside = mkdtempSync(path.join(tmpdir(), "outside-"));
    writeFileSync(path.join(outside, "secret.sql"), "select secret");
    symlinkSync(outside, path.join(dir, "link"));
    expect(await code(store.read("link/secret"))).toBe("invalid");
  });
});

describe("QueryStore.move/duplicate/remove/folders", () => {
  it("move onto existing returns exists", async () => {
    put("a.sql", "A");
    put("b.sql", "B");
    expect(await code(store.move("a", "b"))).toBe("exists");
    expect(await store.read("a")).toBe("A");
    expect(await store.read("b")).toBe("B");
  });

  it("move file into folder", async () => {
    put("a.sql", "A");
    await store.move("a", "F/a2");
    expect(await store.read("F/a2")).toBe("A");
    expect(existsSync(path.join(dir, "a.sql"))).toBe(false);
  });

  it("move folder", async () => {
    put("F/x.sql", "X");
    await store.move("F", "G");
    expect(await store.read("G/x")).toBe("X");
    expect(existsSync(path.join(dir, "F"))).toBe(false);
  });

  it("move missing returns not_found", async () => {
    expect(await code(store.move("nope", "x"))).toBe("not_found");
  });

  it("duplicate copies file", async () => {
    put("a.sql", "A");
    await store.duplicate("a", "a_copy");
    expect(await store.read("a_copy")).toBe("A");
    expect(await store.read("a")).toBe("A");
  });

  it("duplicate onto existing returns exists", async () => {
    put("a.sql");
    put("b.sql");
    expect(await code(store.duplicate("a", "b"))).toBe("exists");
  });

  it("remove file returns its sql", async () => {
    put("a.sql", "A");
    expect(await store.remove("a")).toEqual({ deletedSql: { a: "A" } });
    expect(existsSync(path.join(dir, "a.sql"))).toBe(false);
  });

  it("remove folder returns deleted sql", async () => {
    put("F/x.sql", "X");
    put("F/sub/y.sql", "Y");
    const r = await store.remove("F");
    expect(r.deletedSql).toEqual({ "F/x": "X", "F/sub/y": "Y" });
    expect(existsSync(path.join(dir, "F"))).toBe(false);
  });

  it("createFolder and countQueries", async () => {
    await store.createFolder("Empty");
    expect(statSync(path.join(dir, "Empty")).isDirectory()).toBe(true);
    put("F/x.sql");
    put("F/sub/y.sql");
    expect(await store.countQueries("F")).toBe(2);
  });

  it("createFolder on existing returns exists", async () => {
    await store.createFolder("E");
    expect(await code(store.createFolder("E"))).toBe("exists");
  });
});
