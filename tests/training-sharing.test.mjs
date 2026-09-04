import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/training/page.tsx", import.meta.url), "utf8");
const share = readFileSync(new URL("../app/training/training-share-actions.tsx", import.meta.url), "utf8");

test("the selected Training Academy video exposes a share control", () => {
  assert.match(page, /import \{ TrainingShareActions \}/);
  assert.match(page, /<TrainingShareActions course=\{activeCourse\} \/>/);
  assert.match(share, />\s*Share video\s*</);
});

test("shared training links reopen the matching video", () => {
  assert.match(share, /new URL\("\/training", window\.location\.origin\)/);
  assert.match(share, /url\.searchParams\.set\("video", id\)/);
  assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\("video"\)/);
  assert.match(page, /payload\.videos\.some\(\(video\) => video\.id === requested\)/);
});

test("training sharing supports clipboard, mobile fallback and native sharing", () => {
  assert.match(share, /navigator\.clipboard\?\.writeText/);
  assert.match(share, /document\.execCommand\("copy"\)/);
  assert.match(share, /navigator\.share/);
  assert.match(share, /Copy Job Talk link/);
  assert.match(share, /Share on this device/);
});

test("the Share video dialog is accessible and reliably closes", () => {
  assert.match(share, /role="dialog"/);
  assert.match(share, /aria-modal="true"/);
  assert.match(share, /event\.key === "Escape"/);
  assert.match(share, /event\.target === event\.currentTarget/);
  assert.match(share, /aria-live="polite"/);
  assert.match(share, /document\.body\.style\.overflow = "hidden"/);
});
