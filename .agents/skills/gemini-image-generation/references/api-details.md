# API Details: Interleaved Output, Grounding, and REST Examples

## The `output_image` / `output_text` gotcha {#interleaved-output}

`interaction.output_image` and `interaction.output_text` are convenience properties. They work fine for simple "one prompt → one image" calls, but **they only capture part of the response** when the model produces complex, interleaved text-and-image output — e.g. an illustrated story where text and images alternate across multiple blocks.

Some Gemini 3 models (notably `gemini-3-pro-image`) support this interleaved mode directly: ask for a story "with illustrations" and the model will produce a sequence of alternating text and image content blocks within a single `model_output` step.

For these cases, manually iterate `interaction.steps` instead of relying on the convenience properties:

### Python
```python
interaction = client.interactions.create(
    model="gemini-3-pro-image",
    input="Write the story of the lifecycle of a monarch butterfly, interleave illustrations",
)

image_counter = 1
for step in interaction.steps:
    if step.type == "model_output":
        for content_block in step.content:
            if content_block.type == "text":
                print(content_block.text)
            elif content_block.type == "image":
                filename = f"butterfly_lifecycle_{image_counter}.png"
                with open(filename, "wb") as f:
                    f.write(base64.b64decode(content_block.data))
                print(f"\n[Saved illustration: {filename}]\n")
                image_counter += 1
```

### JavaScript
```javascript
const interaction = await ai.interactions.create({
  model: "gemini-3-pro-image",
  input: "Write the story of the lifecycle of a monarch butterfly, interleave illustrations",
});

let imageCounter = 1;
for (const step of interaction.steps) {
  if (step.type === "model_output") {
    for (const contentBlock of step.content) {
      if (contentBlock.type === "text") {
        console.log(contentBlock.text);
      } else if (contentBlock.type === "image") {
        const buffer = Buffer.from(contentBlock.data, "base64");
        const filename = `butterfly_lifecycle_${imageCounter}.png`;
        fs.writeFileSync(filename, buffer);
        imageCounter++;
      }
    }
  }
}
```

This same "iterate `steps`, check `step.type`" pattern is also how you pull out `thought` steps (interim composition images during Thinking) — see SKILL.md's Thinking section.

## Video-to-image, full pattern {#video-to-image}

`gemini-3.1-flash-image` only. Accepts public YouTube URLs directly, or a Files-API-uploaded local video.

```python
interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input=[
        {"type": "video", "uri": "https://www.youtube.com/watch?v=UTdfxFyOQTI", "mime_type": "video/mp4"},
        {"type": "text", "text": "Generate a poster image that captures the key themes of this video."},
    ],
    response_format={"type": "image", "aspect_ratio": "16:9"},
)

for step in interaction.steps:
    if step.type == "model_output":
        for content_block in step.content:
            if content_block.type == "image":
                with open("video_poster.png", "wb") as f:
                    f.write(base64.b64decode(content_block.data))
```

## Grounding with Google Search — response shape and display requirements {#grounding}

When `tools=[{"type": "google_search"}]` is attached, the response includes additional step types:

- **`google_search_call` / `google_search_result`** — the search the model ran; `google_search_result` contains `search_suggestions`, an HTML snippet for rendering search suggestions in your own UI.
- **`url_citation` annotations** — inline citations on the `text` content block within `model_output`, linking generated content back to its web source.

**Display requirement**: if you use Image Search grounding (see below), you are required by the Gemini API Terms of Service to display the `search_suggestions` HTML from `google_search_result` in your UI. Don't drop this when building a product surface around image generation with search grounding — check `ai.google.dev/gemini-api/terms#grounding-with-google-search` for the exact requirements.

### Google Image Search grounding (Nano Banana 2 only)

Adds real web images as visual reference context for generation, as a `search_types` option alongside standard web search:

```python
interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input="A detailed painting of a Timareta butterfly resting on a flower",
    tools=[{"type": "google_search", "search_types": ["web_search", "image_search"]}],
)
```

Limitations: image-based search results are never passed into the actual generation model as pixels (they inform context, not composition directly), and this mode cannot pull real-world photos of real people from web search results.

## Full REST examples

### Text-to-image
```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": [
      {"type": "text", "text": "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"}
    ]
  }'
```

### Image editing (image + text)
```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": [
      {"type": "text", "text": "Create a picture of my cat eating a nano-banana in a fancy restaurant under the Gemini constellation"},
      {"type": "image", "mime_type": "image/jpeg", "data": "<BASE64_IMAGE_DATA>"}
    ]
  }'
```

### Multi-turn edit via `previous_interaction_id`
```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": "Update this infographic to be in Spanish. Do not change any other elements of the image.",
    "previous_interaction_id": "<PREVIOUS_INTERACTION_ID>",
    "response_format": {
      "type": "image",
      "mime_type": "image/jpeg",
      "aspect_ratio": "16:9",
      "image_size": "2K"
    }
  }'
```

### Thinking level control
```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": "A futuristic city built inside a giant glass bottle floating in space",
    "generation_config": {"thinking_level": "high"}
  }'
```

### Output format: text + image explicitly
```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": "Write a short poem about a starry night and generate an image of it.",
    "response_format": [
      {"type": "text"},
      {"type": "image"}
    ]
  }'
```

### Multi-image composition (5+ reference images)
```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": [
      {"type": "text", "text": "An office group photo of these people, they are making funny faces."},
      {"type": "image", "mime_type": "image/png", "data": "<BASE64_DATA_IMG_1>"},
      {"type": "image", "mime_type": "image/png", "data": "<BASE64_DATA_IMG_2>"},
      {"type": "image", "mime_type": "image/png", "data": "<BASE64_DATA_IMG_3>"}
    ],
    "response_format": {"type": "image", "aspect_ratio": "5:4", "image_size": "2K"}
  }'
```

### Grounded with Google Search
```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image",
    "input": "Visualize the current weather forecast for the next 5 days in San Francisco as a clean, modern weather chart.",
    "tools": [{"type": "google_search"}],
    "response_format": {"type": "image", "mime_type": "image/jpeg", "aspect_ratio": "16:9"}
  }'
```

## Notes on image understanding vs. generation

For multi-image *input* handling beyond what's shown here (supported MIME types, larger payloads, file upload via the Files API instead of inline base64), the Image Understanding docs (`ai.google.dev/gemini-api/docs/image-understanding`) are the canonical source — this skill covers generation/editing, but the input plumbing is shared.
