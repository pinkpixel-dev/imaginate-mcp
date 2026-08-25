# Project memory

Decisions and session notes for imaginate-mcp. Read this at the start of a session. Do not contradict a logged decision without flagging it first.

## Decisions

### Separate tools per provider instead of one unified tool
**Date:** August 25, 2026

**What was decided:** Expose `openai_*` and `gemini_*` tools rather than a single `generate_image` tool with a `provider` argument.

**Why:** Conditional registration is the main reason. Only the tools for configured API keys get registered, so a model can never pick a provider the user has no key for. The two APIs also share almost no parameters, so a unified schema would be mostly conditional fields. Per-provider tool descriptions also help the model pick correctly.

**What was rejected:** A unified tool layer with a `provider` argument, and a unified surface backed by internal adapter modules. Both were rejected once the conditional registration point came up. The adapter idea partly survived: shared plumbing lives in `src/lib/` while provider code stays in `src/providers/`.

### Save images to disk, return file paths
**Date:** August 25, 2026

**What was decided:** Write every generated image to disk and return the absolute path in the tool result.

**Why:** Base64 content blocks burn conversation context on every image and make the result hard to reuse. A returned path feeds straight back into an edit call.

**What was rejected:** Returning MCP image content blocks, and a `return_mode` parameter offering both. Both were rejected as unnecessary for the first version.

### Gemini API through @google/genai, not Vertex AI Imagen
**Date:** August 25, 2026

**What was decided:** Use the Gemini Interactions API through `@google/genai` with API key auth.

**Why:** Simple setup with one API key. Vertex AI Imagen needs a GCP project and service account credentials, which is a much heavier requirement for an MCP server a user drops into a client config.

### Only read model_output steps from Gemini responses
**Date:** August 25, 2026

**What was decided:** `collectImages()` in `src/providers/google/client.ts` walks `interaction.steps` and only reads steps of type `model_output`.

**Why:** `interaction.output_image` only exposes the last image, which loses frames in interleaved output. But walking every step is wrong too. A `user_input` step echoes back the source images of an edit, so every edit would have written its own input back to disk as a result. A `thought` step holds interim composition previews. Both are excluded, and both have tests.

### Register a setup help tool when no provider key is present
**Date:** August 25, 2026

**What was decided:** When neither API key is configured, register `imaginate_setup_help`.

**Why:** An `McpServer` with zero registered tools never installs a `tools/list` handler, so the client gets JSON-RPC `-32601 Method not found`. That is a confusing failure for a missing environment variable. One help tool turns it into a readable answer.

## Session log

### August 25, 2026

**Worked on:** Building imaginate-mcp from an empty directory.

**Completed:**
- Project scaffold, TypeScript strict config, Apache 2.0 license.
- Six image tools across two providers, plus the setup help tool.
- Shared library for config, file handling, error mapping, result formatting, and the model catalog.
- 26 tests on the built-in Node test runner. All passing.
- Verified conditional registration over a real stdio MCP handshake for all four key combinations.
- README, CHANGELOG, technical overview, and roadmap.

**In progress:** Nothing. Version 0.1.0 is complete and builds clean.

**Decisions made:** See the five entries above.

**Next session priorities:**
- Test against live APIs with real keys. Only error paths have been exercised against a live endpoint so far.
- Consider request timeouts, since neither provider call has an explicit ceiling.
- Decide whether remote image URLs are worth supporting for edits.
