import assert from "node:assert/strict";
import test from "node:test";
import { collectImages } from "../src/providers/google/client.js";

const png = (marker: string): string => Buffer.from(marker).toString("base64");

test("collects images from model output steps", () => {
  const images = collectImages({
    steps: [
      { type: "model_output", content: [{ type: "image", data: png("out-1"), mime_type: "image/png" }] },
    ],
  });

  assert.equal(images.length, 1);
  assert.equal(images[0]?.data.toString(), "out-1");
  assert.equal(images[0]?.mimeType, "image/png");
});

test("ignores the source images echoed back in user input steps", () => {
  const images = collectImages({
    steps: [
      { type: "user_input", content: [{ type: "image", data: png("source"), mime_type: "image/png" }] },
      { type: "model_output", content: [{ type: "image", data: png("result"), mime_type: "image/png" }] },
    ],
  });

  assert.equal(images.length, 1);
  assert.equal(images[0]?.data.toString(), "result");
});

test("ignores interim thought images", () => {
  const images = collectImages({
    steps: [
      { type: "thought", summary: [{ type: "image", data: png("draft"), mime_type: "image/png" }] },
      { type: "model_output", content: [{ type: "image", data: png("final"), mime_type: "image/png" }] },
    ],
  });

  assert.equal(images.length, 1);
  assert.equal(images[0]?.data.toString(), "final");
});

test("keeps every image of an interleaved text and image response, in order", () => {
  const images = collectImages({
    steps: [
      {
        type: "model_output",
        content: [
          { type: "text", text: "Panel one:" },
          { type: "image", data: png("panel-1"), mime_type: "image/png" },
          { type: "text", text: "Panel two:" },
          { type: "image", data: png("panel-2"), mime_type: "image/jpeg" },
        ],
      },
    ],
  });

  assert.deepEqual(images.map((image) => image.data.toString()), ["panel-1", "panel-2"]);
  assert.equal(images[1]?.mimeType, "image/jpeg");
});

test("does not save the same image twice", () => {
  const duplicate = png("same");
  const images = collectImages({
    steps: [
      { type: "model_output", content: [{ type: "image", data: duplicate, mime_type: "image/png" }] },
      { type: "model_output", content: [{ type: "image", data: duplicate, mime_type: "image/png" }] },
    ],
  });

  assert.equal(images.length, 1);
});

test("falls back to output_image when steps carry no image", () => {
  const images = collectImages({
    steps: [{ type: "model_output", content: [{ type: "text", text: "here you go" }] }],
    output_image: { data: png("fallback"), mime_type: "image/webp" },
  });

  assert.equal(images.length, 1);
  assert.equal(images[0]?.data.toString(), "fallback");
  assert.equal(images[0]?.mimeType, "image/webp");
});

test("returns nothing when the model replied with text only", () => {
  assert.deepEqual(collectImages({ steps: [{ type: "model_output", content: [{ type: "text", text: "no" }] }] }), []);
  assert.deepEqual(collectImages({}), []);
  assert.deepEqual(collectImages({ steps: "unexpected" }), []);
});

test("defaults a missing mime type to png", () => {
  const images = collectImages({ steps: [{ type: "model_output", content: [{ type: "image", data: png("x") }] }] });
  assert.equal(images[0]?.mimeType, "image/png");
});
