# Technical overview

This is the living technical reference for imaginate-mcp. It explains how the server is put together and why the main decisions were made. For installation and usage, read the [README](../README.md).

## What the server is

imaginate-mcp is a stdio MCP server written in TypeScript. It exposes image generation and editing tools backed by two providers: OpenAI GPT Image and Google Gemini (Nano Banana). It writes every generated image to disk and returns the file path.

The server holds no state between calls. Each tool call is one API request, one or more files written, and one text result.

## Design decisions

### Separate tools per provider

The tools are `openai_*` and `gemini_*` rather than one `generate_image` tool with a `provider` argument. Three reasons.

First, conditional registration. The server only registers the tools for the providers whose API key is present. A model cannot pick a provider the user has no key for, because that provider's tools do not exist in the tool list.

Second, honest schemas. The two APIs share very little. OpenAI takes `size`, `quality`, `background`, and `output_format`. Gemini takes `aspect_ratio`, `image_size`, `thinking_level`, and a grounding flag. A shared schema would mark most parameters as "ignored unless provider is X", which models handle badly.

Third, better descriptions. Each tool description can say what that specific model family is good at, which is the main thing that drives correct tool selection.

### Files on disk, not base64 in the response

Image tools that return base64 content blocks push a large payload into the conversation for every image. That burns context and makes the image hard to reuse.

This server writes the file and returns the path. A path from a generate call goes straight into the `images` argument of an edit call, which makes iteration cheap.

### Shared plumbing, separate providers

Provider code lives in `src/providers/openai/` and `src/providers/google/`. Everything both providers need lives in `src/lib/`: file saving, error mapping, result formatting, and the model catalog. Adding a third provider means one new directory and one new registration call in `src/index.ts`.

## Module map

```
src/
  index.ts                  Server startup, conditional registration, stdio transport
  config.ts                 Environment parsing into a ServerConfig
  lib/
    files.ts                Path resolution, image loading, collision-safe saving
    errors.ts               Maps provider errors to actionable text
    result.ts               Formats tool results
    models.ts               Model catalog data and its markdown renderer
  providers/
    openai/
      client.ts             Wraps openai.images.generate and openai.images.edit
      tools.ts              Zod schemas, descriptions, and handlers
    google/
      client.ts             Wraps the Gemini Interactions API
      tools.ts              Zod schemas, descriptions, and handlers
tests/
```

Every source file stays under 500 lines. The two `tools.ts` files are the largest, at around 280 and 300 lines, mostly tool descriptions.

## Startup

`src/index.ts` does four things:

1. Calls `loadConfig()` to read the environment.
2. Registers the OpenAI tools if `config.openai` exists.
3. Registers the Gemini tools if `config.google` exists.
4. Registers `imaginate_setup_help` if neither exists.

Step 4 solves a real problem. An `McpServer` with no registered tools does not install a `tools/list` handler, so a client gets JSON-RPC error `-32601 Method not found` instead of an empty list. Registering one help tool makes the failure readable.

All logging goes to stderr. Stdout carries the MCP protocol, so anything written there corrupts the stream.

## Configuration

`loadConfig()` builds a `ServerConfig` with an optional block per provider. A provider block only exists when its key is present, and that presence is what gates registration.

`GEMINI_API_KEY` is checked before `GOOGLE_API_KEY`. Both work.

`IMAGINATE_OUTPUT_DIR` goes through `expandHome()` and then `path.resolve()`, so a leading `~` works and the stored value is always absolute. This matters because MCP clients start servers from unpredictable working directories.

## File handling

`src/lib/files.ts` owns everything that touches the filesystem.

**Loading.** `loadImage()` resolves the path, reads the bytes, infers the MIME type from the extension, and returns both the buffer and its base64 form. OpenAI needs the buffer, Gemini needs the base64 string. A read failure is rewritten into a message that tells the caller to pass an absolute path and that remote URLs are unsupported, because that is the actual fix nearly every time.

**Saving.** `saveImage()` strips anything outside `[\w.-]` from the base name, which keeps a caller-supplied `filename` from writing outside the output directory. It then checks for a free name, appending `-1`, `-2`, and so on until it finds one. Nothing is ever overwritten.

**Naming.** `buildBaseName()` uses `filename` when the caller gives one, minus its extension. Otherwise it builds `{prefix}-{prompt-slug}-{timestamp}`. When a call returns several images, the index is appended.

## Provider clients

### OpenAI

`OpenAIImageClient` wraps `images.generate` and `images.edit`. Source images are converted with the SDK's `toFile()` helper. The response comes back as base64 in `data[].b64_json`, and the output MIME type is derived from the requested `output_format` since the API does not return it.

`revised_prompt` is surfaced in the result when the model rewrites the prompt, so the caller can see what was actually drawn.

### Gemini

`GeminiImageClient` wraps `interactions.create`. Input is built as an array of typed blocks: one text block followed by one image block per reference. Aspect ratio and resolution go into `response_format`.

Reading images back out is the subtle part. `interaction.output_image` is a convenience property that only exposes the last image, which loses frames in an interleaved text and image response. So `collectImages()` walks `interaction.steps` instead, and it only reads steps of type `model_output`.

That restriction is load bearing. A `user_input` step echoes back the source images of an edit, and a `thought` step holds the model's interim composition previews. Reading either would save images the caller never asked for. Reading `user_input` steps would have made every edit write its own input back to disk as a result. There is a test for each case.

`collectImages()` also deduplicates by base64 payload and falls back to `output_image` when no step carried an image.

## Error handling

Every handler is wrapped in `guard()`, which catches anything thrown and converts it into an MCP error result. Nothing escapes as a transport-level failure.

`toToolError()` maps the error to advice rather than just restating it:

| Condition | What the caller is told |
| --- | --- |
| `moderation_blocked` | Rewrite the prompt. Do not retry the same one |
| 401 or 403 | The key was rejected. Do not retry with the same key |
| 429 | Wait and retry, or lower quality or image count |
| 400 mentioning verification | The organization needs verification for GPT Image models |
| 404 | Call the matching list-models tool for valid IDs |
| 5xx | Retry once before changing the request |

The point is that the caller is usually a model, and a model that reads "authentication failed" will often retry the same broken call. Telling it not to retry saves a loop.

Provider errors nest their body differently, so the mapper checks both `error.code` and `error.error.code`.

## Testing

Tests live in `tests/` and run on Node's built-in test runner. `npm test` compiles `tsconfig.test.json` to `dist-test/` and runs the compiled files. The extra tsconfig exists because the source uses `.js` import specifiers under `Node16` module resolution, which the type stripping loader does not resolve.

Three files, 26 tests:

- `files.test.ts` covers slug building, MIME mapping, collision handling, path traversal in `filename`, directory creation, and the load errors.
- `gemini-collect.test.ts` covers step walking, including the `user_input` and `thought` exclusions, interleaved output, deduplication, and the `output_image` fallback.
- `errors.test.ts` covers each branch of the error mapper.

No test calls a live API, so the suite runs without keys.

## Dependencies

| Package | Version | Why |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` | ^1.30.0 | MCP server and stdio transport |
| `openai` | ^7.5.0 | OpenAI Image API client |
| `@google/genai` | ^2.18.0 | Gemini Interactions API client |
| `zod` | ^4.4.3 | Tool input schemas. The MCP SDK accepts `^3.25` or `^4.0` |

TypeScript builds with `strict` and `noUncheckedIndexedAccess` on, targeting ES2022 with `Node16` modules.

## Known gaps

- No streaming or partial images. Both APIs support it, neither is wired up.
- Source images must be local. There is no URL fetching.
- The model catalog in `lib/models.ts` is static data. Neither provider offers a clean image-model listing endpoint, so this drifts as models ship.
- Gemini requests carry no explicit timeout beyond the SDK default.
