# Roadmap

Where this project might go next. Nothing here is committed, and the order will change based on what turns out to be annoying in real use.

## Near term

**Remote image URLs.** Right now edit tools only take local paths. Fetching an image over HTTP before an edit would remove a manual download step. This needs care around size limits and content type checks.

**Request timeouts.** OpenAI can take up to two minutes on a complex prompt, and there is currently no explicit timeout on either provider. A configurable ceiling would stop a hung request from blocking a client.

**Batch and variation helpers.** Gemini does not reliably honor a requested image count. A tool that runs the same prompt several times and returns all the paths would give a real variations workflow on both providers.

## Worth exploring

**Streaming partial images.** Both APIs can stream progress. MCP has no obvious way to show a partial image mid-call, so this needs a design that is actually useful rather than just technically possible.

**More providers.** The adapter layout in `src/providers/` was built so a third provider is a new directory plus one registration call. Candidates are Imagen on Vertex AI, and OpenRouter's image API for access to several models behind one key.

**An MCP resource for recent output.** Exposing the output directory as a resource would let a client browse what has been generated without a tool call.

**Prompt helpers.** MCP prompts that carry the provider-specific prompting patterns, like Gemini's "change only X, keep everything else the same" phrasing for semantic inpainting.

## Probably not

**Returning base64 image content.** This was considered and rejected. Inline images burn context for every generation and make the result harder to reuse. If someone genuinely needs inline display, a `return_mode` parameter is the way to add it, but that is a request-driven change rather than a default.

**A unified cross-provider tool.** The provider split exists on purpose. Merging the tools would break conditional registration and force a lossy shared schema.

## Feedback

Requests and bug reports go to [the repository](https://github.com/pinkpixel-dev/imaginate-mcp) or [admin@pinkpixel.dev](mailto:admin@pinkpixel.dev).
