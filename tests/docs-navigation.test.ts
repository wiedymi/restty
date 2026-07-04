import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "bun:test";
import { source } from "../playground/app/lib/source";

const docsRoot = resolve(import.meta.dir, "..", "playground/content/docs");

function slugForMeta(page: ReturnType<typeof source.getPages>[number]): string {
  return page.slugs.length === 0 ? "index" : page.slugs.join("/");
}

test("docs navigation source matches mdx metadata", () => {
  const meta = JSON.parse(readFileSync(resolve(docsRoot, "meta.json"), "utf8")) as {
    pages: string[];
  };

  const sourcePages = source.getPages().map(slugForMeta).sort();
  const metaPages = [...meta.pages].sort();

  expect(sourcePages).toEqual(metaPages);
});

test("docs navigation pages point at existing content files", () => {
  for (const page of source.getPages()) {
    const fileName = page.slugs.length === 0 ? "index.mdx" : `${page.slugs.join("/")}.mdx`;
    expect(existsSync(resolve(docsRoot, fileName))).toBe(true);
  }
});
