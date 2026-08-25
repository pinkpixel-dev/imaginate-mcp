import assert from "node:assert/strict";
import test from "node:test";
import { toToolError } from "../src/lib/errors.js";

function apiError(fields: Record<string, unknown>): Error {
  return Object.assign(new Error("boom"), fields);
}

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.map((block) => block.text ?? "").join("");
}

test("moderation blocks tell the caller to rewrite the prompt", () => {
  const result = toToolError("OpenAI", apiError({ code: "moderation_blocked", message: "flagged" }));
  assert.equal(result.isError, true);
  assert.match(textOf(result), /Rewrite the prompt/);
});

test("auth failures say not to retry", () => {
  const result = toToolError("OpenAI", apiError({ status: 401, message: "bad key" }));
  assert.match(textOf(result), /Do not retry with the same key/);
});

test("rate limits suggest waiting or lowering quality", () => {
  const result = toToolError("Gemini", apiError({ status: 429, message: "slow down" }));
  assert.match(textOf(result), /Wait a few seconds and retry/);
});

test("unverified organizations get the verification hint", () => {
  const result = toToolError("OpenAI", apiError({ status: 400, message: "Your organization must be verified" }));
  assert.match(textOf(result), /organization verification/i);
});

test("unknown models point at the list tool", () => {
  const result = toToolError("Gemini", apiError({ status: 404, message: "no such model" }));
  assert.match(textOf(result), /list-models tool/);
});

test("server errors suggest a single retry", () => {
  const result = toToolError("Gemini", apiError({ status: 503, message: "unavailable" }));
  assert.match(textOf(result), /retry once/);
});

test("nested provider error bodies are unwrapped", () => {
  const result = toToolError("Gemini", apiError({ error: { code: "429", message: "quota exhausted" }, status: 429 }));
  assert.match(textOf(result), /quota exhausted/);
});

test("non-Error throws still produce a readable message", () => {
  assert.match(textOf(toToolError("OpenAI", "something odd")), /something odd/);
});
