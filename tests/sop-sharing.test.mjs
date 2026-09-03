import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/vivadocs/page.tsx", import.meta.url), "utf8");
const share = readFileSync(new URL("../app/vivadocs/sop-share-actions.tsx", import.meta.url), "utf8");

test("every selected SOP exposes the shared link control", () => {
  assert.match(page, /import \{ SopShareActions \}/);
  assert.match(page, /<SopShareActions sop=\{selected\} \/>/);
  assert.match(share, />\s*Share SOP\s*</);
});

test("shared SOP links point to the library and reopen the matching reference", () => {
  assert.match(share, /url\.searchParams\.set\("view", "library"\)/);
  assert.match(share, /url\.searchParams\.set\("procedure", reference\)/);
  assert.match(page, /params\.get\("procedure"\)/);
  assert.match(page, /sop\.reference\.toLowerCase\(\) === requestedProcedure\.toLowerCase\(\)/);
  assert.match(page, /setSelectedId\(matchingSop\.id\)/);
});

test("sharing supports clipboard, mobile fallback and the native share menu", () => {
  assert.match(share, /navigator\.clipboard\?\.writeText/);
  assert.match(share, /document\.execCommand\("copy"\)/);
  assert.match(share, /navigator\.share/);
  assert.match(share, /Copy Job Talk link/);
  assert.match(share, /Share on this device/);
});

test("Share SOP dialog is accessible and closes by keyboard or backdrop", () => {
  assert.match(share, /role="dialog"/);
  assert.match(share, /aria-modal="true"/);
  assert.match(share, /event\.key === "Escape"/);
  assert.match(share, /event\.target === event\.currentTarget/);
  assert.match(share, /aria-live="polite"/);
});
