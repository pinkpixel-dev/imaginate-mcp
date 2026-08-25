import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildBaseName,
  extensionForMime,
  loadImage,
  mimeForPath,
  resolveOutputDir,
  saveImage,
  slugFromPrompt,
} from "../src/lib/files.js";

async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "imaginate-test-"));
}

test("slugFromPrompt makes a safe, trimmed slug", () => {
  assert.equal(slugFromPrompt("A red fox, running!"), "a-red-fox-running");
  assert.equal(slugFromPrompt("***"), "image");
  assert.ok(slugFromPrompt("x".repeat(200)).length <= 40);
  assert.ok(!slugFromPrompt("hello world ".repeat(20)).endsWith("-"));
});

test("mime and extension mapping round-trips known formats", () => {
  assert.equal(extensionForMime("image/jpeg"), "jpg");
  assert.equal(extensionForMime("image/webp"), "webp");
  assert.equal(extensionForMime(undefined), "png");
  assert.equal(extensionForMime("application/pdf"), "png");
  assert.equal(mimeForPath("/tmp/a.JPEG"), "image/jpeg");
  assert.equal(mimeForPath("/tmp/a.unknown"), "image/png");
});

test("saveImage never overwrites an existing file", async () => {
  const dir = await tempDir();
  const data = Buffer.from("fake-png-bytes");

  const first = await saveImage({ data, outputDir: dir, baseName: "cat", mimeType: "image/png" });
  const second = await saveImage({ data, outputDir: dir, baseName: "cat", mimeType: "image/png" });
  const third = await saveImage({ data, outputDir: dir, baseName: "cat", mimeType: "image/png" });

  assert.equal(path.basename(first.filePath), "cat.png");
  assert.equal(path.basename(second.filePath), "cat-1.png");
  assert.equal(path.basename(third.filePath), "cat-2.png");
  assert.equal(first.bytes, data.byteLength);
  assert.deepEqual((await fs.readdir(dir)).sort(), ["cat-1.png", "cat-2.png", "cat.png"]);
});

test("saveImage strips path separators out of the base name", async () => {
  const dir = await tempDir();
  const saved = await saveImage({
    data: Buffer.from("x"),
    outputDir: dir,
    baseName: "../../escape",
    mimeType: "image/png",
  });
  assert.equal(path.dirname(saved.filePath), dir);
  assert.ok(!saved.fileName.includes("/"));
});

test("buildBaseName honors an explicit filename and numbers batches", () => {
  const explicit = buildBaseName({ requestedName: "hero.png", prompt: "ignored", prefix: "openai", index: 0, total: 1 });
  assert.equal(explicit, "hero");

  const batched = buildBaseName({ requestedName: "hero.png", prompt: "ignored", prefix: "openai", index: 1, total: 3 });
  assert.equal(batched, "hero-2");

  const generated = buildBaseName({ requestedName: undefined, prompt: "a red fox", prefix: "gemini", index: 0, total: 1 });
  assert.match(generated, /^gemini-a-red-fox-\d{8}-\d{6}-\d{3}$/);
});

test("resolveOutputDir creates the directory it returns", async () => {
  const base = await tempDir();
  const target = path.join(base, "nested", "deeper");
  const resolved = await resolveOutputDir(target, base);
  assert.equal(resolved, target);
  assert.ok((await fs.stat(resolved)).isDirectory());
});

test("resolveOutputDir falls back when nothing is requested", async () => {
  const base = path.join(await tempDir(), "fallback");
  assert.equal(await resolveOutputDir(undefined, base), base);
});

test("loadImage reads bytes and infers the mime type", async () => {
  const dir = await tempDir();
  const file = path.join(dir, "sample.jpg");
  await fs.writeFile(file, Buffer.from("jpeg-bytes"));

  const loaded = await loadImage(file);
  assert.equal(loaded.mimeType, "image/jpeg");
  assert.equal(loaded.fileName, "sample.jpg");
  assert.equal(loaded.base64, Buffer.from("jpeg-bytes").toString("base64"));
});

test("loadImage explains a missing path instead of leaking ENOENT", async () => {
  await assert.rejects(loadImage("/definitely/not/here.png"), (error: Error) => {
    assert.match(error.message, /absolute path/);
    assert.match(error.message, /Remote URLs are not supported/);
    return true;
  });
});

test("loadImage rejects an empty file", async () => {
  const dir = await tempDir();
  const file = path.join(dir, "empty.png");
  await fs.writeFile(file, Buffer.alloc(0));
  await assert.rejects(loadImage(file), /is empty/);
});
