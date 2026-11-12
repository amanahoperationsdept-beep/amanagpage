import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchAllGraphPages } from "./meta-graph.ts";

Deno.test("returns a single unpaginated Graph API page", async () => {
  const result = await fetchAllGraphPages(async () => ({ data: [{ id: "1" }] }));
  assertEquals(result, { data: [{ id: "1" }], pagesFetched: 1, truncated: false });
});

Deno.test("follows cursors and combines every page", async () => {
  const requested: (string | undefined)[] = [];
  const result = await fetchAllGraphPages(async (after) => {
    requested.push(after);
    if (!after) return { data: [{ id: "1" }], paging: { next: "present", cursors: { after: "cursor-1" } } };
    if (after === "cursor-1") return { data: [{ id: "2" }], paging: { next: "present", cursors: { after: "cursor-2" } } };
    return { data: [{ id: "3" }] };
  });
  assertEquals(requested, [undefined, "cursor-1", "cursor-2"]);
  assertEquals(result, { data: [{ id: "1" }, { id: "2" }, { id: "3" }], pagesFetched: 3, truncated: false });
});

Deno.test("marks a page as truncated when next cursor is missing", async () => {
  const result = await fetchAllGraphPages(async () => ({
    data: [{ id: "1" }],
    paging: { next: "present", cursors: {} },
  }));
  assertEquals(result.truncated, true);
  assertEquals(result.pagesFetched, 1);
});

Deno.test("stops safely when a cursor repeats", async () => {
  const result = await fetchAllGraphPages(async () => ({
    data: [{ id: "1" }],
    paging: { next: "present", cursors: { after: "same-cursor" } },
  }));
  // The repeated cursor is detected on the second page.
  const repeated = await fetchAllGraphPages(async () => ({
    data: [{ id: "1" }],
    paging: { next: "present", cursors: { after: "same-cursor" } },
  }), 2);
  assertEquals(repeated.truncated, true);
  assertEquals(repeated.pagesFetched, 2);
  assertEquals(result.truncated, true);
});

Deno.test("enforces the maximum page count", async () => {
  let calls = 0;
  const result = await fetchAllGraphPages(async () => {
    calls += 1;
    return { data: [{ id: String(calls) }], paging: { next: "present", cursors: { after: "cursor-" + calls } } };
  }, 2);
  assertEquals(calls, 2);
  assertEquals(result.truncated, true);
  assertEquals(result.pagesFetched, 2);
});

Deno.test("rejects invalid page limits", async () => {
  await assertRejects(() => fetchAllGraphPages(async () => ({ data: [] }), 0));
  await assertRejects(() => fetchAllGraphPages(async () => ({ data: [] }), 1.5));
});
