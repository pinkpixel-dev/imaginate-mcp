---
name: gemini-image-generation
description: Complete reference for generating and editing images with Gemini's Nano Banana models (Gemini 3 Pro Image, Gemini 3.1 Flash Image, Gemini 3.1 Flash Lite Image, legacy Gemini 2.5 Flash Image) via the Interactions API. ALWAYS trigger when the user wants to generate, edit, remix, or upscale images with Gemini, mentions "Nano Banana", "Nano Banana Pro", "gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-2.5-flash-image", image-to-image editing, inpainting/masking, style transfer, character consistency, multi-image composition (up to 14 refs), text-in-image rendering, Google Search-grounded image generation, video-to-image, or Gemini image aspect ratios/resolution (1K/2K/4K)/token pricing/thinking_level. Also trigger for any TypeScript/Python/Go/REST app that should generate images with Gemini instead of another provider, or when comparing Gemini image generation to other providers. If the user just says "generate an image with Gemini" without more detail, check this skill first.
---

# Gemini Image Generation (Nano Banana)

**Nano Banana** is the umbrella name for Gemini's native image generation and editing models, accessed through the **Interactions API** (`client.interactions.create(...)`). Unlike a dedicated image endpoint, these are full multimodal Gemini models — they take text and/or images in, and can return interleaved text + image(s) out, in the same conversational thread.

This skill is the router. Deep-dive reference material lives in `references/` — read those files when you need the full tables, prompt templates, or troubleshooting details rather than trying to hold it all in this file.

> This skill builds on the Interactions API itself. If you need general Interactions API mechanics (streaming, function calling, `previous_interaction_id`, structured output, background execution) that aren't image-specific, also check the `gemini-interactions-api` skill — it's the broader foundation this one sits on top of.

## Model lineup — pick the right one

| Model | ID | Best for |
|---|---|---|
| **Nano Banana 2 Lite** | `gemini-3.1-flash-lite-image` | Fastest + cheapest. High-volume/scale use cases. 1K resolution only. No multi-reference or multi-turn editing optimization, no Google Search grounding. |
| **Nano Banana 2** | `gemini-3.1-flash-image` | **Default choice for most work.** Best speed/quality/cost balance. 4K output, strong text rendering, up to 10 high-fidelity reference objects + 4 character-consistency refs, Google Search + Google Image Search grounding, video-to-image support. |
| **Nano Banana Pro** | `gemini-3-pro-image` | Premium/professional asset production. Highest world knowledge, best brand/localization accuracy, most precise creative control, up to 4K, interleaved text+image story output. |
| **Nano Banana (legacy)** | `gemini-2.5-flash-image` | Legacy pioneer model. Still works, but recommend migrating callers to Nano Banana 2 Lite for better quality/speed/price. |

Default to `gemini-3.1-flash-image` unless the user's ask clearly points to one of the others (raw speed/cost at scale → Lite; top-tier professional/branding work → Pro; explicitly working with an existing legacy integration → 2.5 Flash Image).

All generated images carry an invisible SynthID watermark — mention this if the user asks about provenance/watermarking.

## Setup

**Python**: `pip install -U google-genai` (`from google import genai`)
**JavaScript/TypeScript**: `npm install @google/genai` (`import { GoogleGenAI } from "@google/genai"`)

Auth via `GEMINI_API_KEY` env var (Python/JS clients pick it up automatically) or `x-goog-api-key` header for raw REST.

## Text-to-image

### Python
```python
from google import genai
import base64

client = genai.Client()

interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input="Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme",
)

with open("generated_image.png", "wb") as f:
    f.write(base64.b64decode(interaction.output_image.data))
```

### JavaScript
```javascript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({});

const interaction = await ai.interactions.create({
  model: "gemini-3.1-flash-image",
  input: "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme",
});

const generatedImage = interaction.output_image;
if (generatedImage) {
  fs.writeFileSync("gemini-native-image.png", Buffer.from(generatedImage.data, "base64"));
}
```

`interaction.output_image` is a convenience property returning the last generated image block. **It does NOT capture everything** for interleaved text+image responses (e.g. illustrated stories) — for those, manually iterate `interaction.steps` (see `references/api-details.md#interleaved-output`).

## Image editing (image + text → image)

Provide a base64-encoded image alongside your text prompt. The model matches the original's style, lighting, and perspective unless told otherwise.

```python
with open("/path/to/cat_image.png", "rb") as f:
    image_bytes = f.read()

interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input=[
        {"type": "text", "text": "Add a small knitted wizard hat on the cat's head"},
        {"type": "image", "data": base64.b64encode(image_bytes).decode('utf-8'), "mime_type": "image/png"},
    ],
)
```

Common editing patterns (full templates + prompts in `references/prompting-guide.md`):
- **Add/remove elements** — describe the change and how it should integrate
- **Inpainting/masking** — "change only the X, keep everything else exactly the same" (no literal mask needed — semantic description does the job)
- **Style transfer** — "transform this photo into the style of X"
- **Multi-image composition** — pass up to 14 reference images (limits vary by model, see table below) to combine elements from several sources into one new scene
- **High-fidelity detail preservation** — explicitly state which features must stay unchanged when adding an element
- **Sketch-to-final** — turn a rough sketch into a finished rendered image
- **Character consistency / 360° views** — iteratively prompt different angles, feeding prior outputs back in as reference images

### Reference image limits by model

| | Nano Banana 2 Lite | Nano Banana 2 | Nano Banana Pro |
|---|---|---|---|
| High-fidelity object refs | up to 14 | up to 10 | up to 6 |
| Character-consistency refs | n/a | up to 4 | up to 5 |
| Style refs | n/a | n/a | up to 3 |

`gemini-2.5-flash-image` (legacy) works best with up to 3 input images total.

## Multi-turn editing (recommended way to iterate)

Chain edits with `previous_interaction_id` instead of re-sending images/context each time:

```python
interaction_2 = client.interactions.create(
    model="gemini-3.1-flash-image",
    input="Update this infographic to be in Spanish. Do not change any other elements of the image.",
    previous_interaction_id=interaction.id,
    response_format={"type": "image", "mime_type": "image/jpeg", "aspect_ratio": "16:9", "image_size": "2K"},
)
```

## Output format control

By default the model returns text + image conversationally. Control this with `response_format`:

- **Image only**: `response_format={"type": "image"}`
- **Text + image explicitly**: `response_format=[{"type": "text"}, {"type": "image"}]`
- **Aspect ratio + resolution**: `response_format={"type": "image", "aspect_ratio": "16:9", "image_size": "2K"}`

`image_size` must use an **uppercase K** — `1K`, `2K`, `4K`, and (Nano Banana 2 only) `512px`/`0.5K`. Lowercase is rejected. If you don't specify `aspect_ratio`, the model matches your input image's ratio, or defaults to `1:1`. Full aspect-ratio/resolution/token-cost tables (per model) are in `references/aspect-ratios-and-pricing.md` — check there before quoting exact pixel dimensions or token costs to the user, since these are the kind of details that shift between model versions.

## Thinking (Gemini 3 image models)

Gemini 3 image models (`gemini-3.1-flash-image`, `gemini-3-pro-image`) always run a "thinking" pass before finalizing an image — generating up to two interim/thought images to refine composition. This is **on by default and can't be disabled**, and thinking tokens are billed regardless of whether you inspect them.

For `gemini-3.1-flash-image` you can tune it via `generation_config={"thinking_level": "high"}` (default is `"minimal"`) to trade latency for quality on tricky prompts.

To inspect the thought process:
```python
for step in interaction.steps:
    if step.type == "thought":
        for content_block in step.summary:
            if content_block.type == "image":
                # interim composition preview
                ...
```

## Grounding with Google Search

Attach the Google Search tool so the model can pull in real-time facts (weather, stock charts, recent events, sports scores) before generating:

```python
interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input="Visualize the current 5-day weather forecast for San Francisco as a clean chart",
    tools=[{"type": "google_search"}],
)
```

For `gemini-3.1-flash-image` specifically, you can also enable **Google Image Search grounding** — real web images as visual reference material — by adding `search_types`:
```python
tools=[{"type": "google_search", "search_types": ["web_search", "image_search"]}]
```
Image-search-grounded responses require you to surface `search_suggestions` from the `google_search_result` step in your UI per Google's ToS — see `references/api-details.md#grounding` for the display requirements. Note: image-based search results themselves are never passed into the generated image, and grounded image search doesn't support pulling real photos of real people from the web.

## Video-to-image (Nano Banana 2 only)

`gemini-3.1-flash-image` can use a YouTube URL or an uploaded video (via the Files API) as visual reference context — useful for thumbnails, posters, or scene-inspired art:

```python
interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input=[
        {"type": "video", "uri": "https://www.youtube.com/watch?v=...", "mime_type": "video/mp4"},
        {"type": "text", "text": "Generate a poster image that captures the key themes of this video."},
    ],
    response_format={"type": "image", "aspect_ratio": "16:9"},
)
```

## Batch generation

All of the above can run through the [Batch API](https://ai.google.dev/gemini-api/docs/batch-api#image-generation) for higher rate limits in exchange for up to a 24-hour turnaround — worth mentioning if the user needs to generate many images at once rather than interactively.

## Prompting well

Short version — be hyper-specific (describe materials, lighting, camera angle, not just the subject), state the *purpose* of the image, iterate conversationally rather than expecting a perfect first try, use step-by-step scene construction for complex composites, phrase exclusions positively ("empty street" not "no cars"), and generate any embedded text *before* asking for the full image with that text rendered in. **Full prompt templates for 7 image-generation patterns and 7 image-editing patterns (with example prompts) live in `references/prompting-guide.md`** — read that file whenever the user wants help crafting a prompt rather than just wiring up the API call.

## Other Gemini image/video models to know about (not this skill)

- **[Imagen](https://ai.google.dev/gemini-api/docs/imagen)** — Google's dedicated text-to-image models (different API surface, different skill territory).
- **[Veo](https://ai.google.dev/gemini-api/docs/video)** — Google's video generation model.

## Limitations to flag proactively

- Best-supported languages: EN, ar-EG, de-DE, es-MX, fr-FR, hi-IN, id-ID, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, ua-UA, vi-VN, zh-CN.
- No audio input support. Video input only on `gemini-3.1-flash-image`.
- The model won't always hit an exact requested image *count* (e.g. "give me 4 variations").
- `gemini-2.5-flash-image` works best with ≤3 input images; see the reference-image table above for current-gen models.
- `gemini-3.1-flash-image` Search grounding can't pull real photos of real people from the web.
- All output is SynthID-watermarked.

## Reference files

- `references/prompting-guide.md` — Full prompt templates + example prompts for 7 generation patterns (photorealistic scenes, stickers/illustrations, text-in-image, product mockups, negative-space design, comic panels, search-grounded) and 6 editing patterns (add/remove, inpainting, style transfer, multi-image composition, detail preservation, sketch-to-final, 360° character views).
- `references/aspect-ratios-and-pricing.md` — Full per-model tables of supported aspect ratios, exact pixel dimensions, and image token costs at each resolution tier for Nano Banana 2 Lite, Nano Banana 2, Nano Banana Pro, and legacy Nano Banana.
- `references/api-details.md` — Interleaved text+image output handling, the `output_image`/`output_text` convenience-property gotcha, Google Search grounding response shape and display requirements, and REST request/response shapes for every pattern above.

This skill was built from the live Gemini API docs (ai.google.dev/gemini-api/docs/image-generation). Gemini model names and pricing move fast — if something looks off or a model ID 404s, re-fetch the docs page rather than assuming this skill is still current.
