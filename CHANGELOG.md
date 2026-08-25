# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 - August 25, 2026

First working version.

### 🎨 Tools

- `openai_generate_image` for text to image with GPT Image models, with control over size, quality, background, output format, and moderation strictness.
- `openai_edit_image` for single image editing, mask based inpainting, and multi-image composition. Accepts up to 16 local source images.
- `gemini_generate_image` for text to image with Nano Banana models, with aspect ratio, resolution tier, thinking level, and optional Google Search or Google Image Search grounding.
- `gemini_edit_image` for editing, style transfer, semantic inpainting, and multi-image composition. Supports `previous_interaction_id` so you can keep refining an image without uploading it again.
- `openai_list_image_models` and `gemini_list_image_models` describe the available model IDs, their strengths, and their limits.

### 🔑 Configuration

- Tools are registered per provider, based on which API keys are present. Set only `OPENAI_API_KEY` and only the `openai_*` tools appear.
- `imaginate_setup_help` is registered when no provider key is found, so a client gets a readable explanation instead of an empty tool list.
- Reads `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), `IMAGINATE_OUTPUT_DIR`, `IMAGINATE_OPENAI_MODEL`, `IMAGINATE_GEMINI_MODEL`, and `OPENAI_BASE_URL`.

### 💾 File handling

- Images are saved to disk and the tools return absolute paths, which keeps large base64 payloads out of the conversation.
- Saving never overwrites an existing file. A name collision gets a numeric suffix.
- Default file names combine the provider prefix, a slug of the prompt, and a timestamp.
- Source images are read from local paths only and are never modified.

### 🐛 Fixes

- Gemini image collection reads only `model_output` steps. Reading every step would have saved the source images of an edit and the model's interim thinking previews as if they were results.

### 🧪 Tests

- 26 tests covering file naming and collision handling, path and MIME handling, Gemini response parsing, and error message mapping. None of them call a live API.
