# Aspect Ratios, Resolutions & Image Token Costs

These tables are the kind of volatile data that changes as Google ships new model versions — **verify against current pricing docs** (`ai.google.dev/gemini-api/docs/pricing`) before quoting exact dollar costs to a user; the token counts below are what the image-generation docs page reported at the time this skill was built.

Set aspect ratio and resolution via `response_format`:
```python
response_format={
    "type": "image",
    "aspect_ratio": "16:9",
    "image_size": "2K",
}
```

`image_size` must be uppercase (`1K`, `2K`, `4K`, `512px`/`0.5K`) — lowercase is rejected by the API. If omitted, output matches the input image's aspect ratio, or defaults to `1:1`.

## Gemini 3.1 Flash Image (Nano Banana 2)

Supports 512px (0.5K), 1K, 2K, and 4K. Widest aspect-ratio selection of any current model.

| Aspect ratio | 0.5K resolution | 0.5K tokens | 1K resolution | 1K tokens | 2K resolution | 2K tokens | 4K resolution | 4K tokens |
|---|---|---|---|---|---|---|---|---|
| 1:1 | 512x512 | 747 | 1024x1024 | 1120 | 2048x2048 | 1680 | 4096x4096 | 2520 |
| 1:4 | 256x1024 | 747 | 512x2048 | 1120 | 1024x4096 | 1680 | 2048x8192 | 2520 |
| 1:8 | 192x1536 | 747 | 384x3072 | 1120 | 768x6144 | 1680 | 1536x12288 | 2520 |
| 2:3 | 424x632 | 747 | 848x1264 | 1120 | 1696x2528 | 1680 | 3392x5056 | 2520 |
| 3:2 | 632x424 | 747 | 1264x848 | 1120 | 2528x1696 | 1680 | 5056x3392 | 2520 |
| 3:4 | 448x600 | 747 | 896x1200 | 1120 | 1792x2400 | 1680 | 3584x4800 | 2520 |
| 4:1 | 1024x256 | 747 | 2048x512 | 1120 | 4096x1024 | 1680 | 8192x2048 | 2520 |
| 4:3 | 600x448 | 747 | 1200x896 | 1120 | 2400x1792 | 1680 | 4800x3584 | 2520 |
| 4:5 | 464x576 | 747 | 928x1152 | 1120 | 1856x2304 | 1680 | 3712x4608 | 2520 |
| 5:4 | 576x464 | 747 | 1152x928 | 1120 | 2304x1856 | 1680 | 4608x3712 | 2520 |
| 8:1 | 1536x192 | 747 | 3072x384 | 1120 | 6144x768 | 1680 | 12288x1536 | 2520 |
| 9:16 | 384x688 | 747 | 768x1376 | 1120 | 1536x2752 | 1680 | 3072x5504 | 2520 |
| 16:9 | 688x384 | 747 | 1376x768 | 1120 | 2752x1536 | 1680 | 5504x3072 | 2520 |
| 21:9 | 792x168 | 747 | 1584x672 | 1120 | 3168x1344 | 1680 | 6336x2688 | 2520 |

## Gemini 3 Pro Image (Nano Banana Pro) / Gemini 3.1 Pro Image

Supports 1K, 2K, and 4K (no 512px tier).

| Aspect ratio | 1K resolution | 1K tokens | 2K resolution | 2K tokens | 4K resolution | 4K tokens |
|---|---|---|---|---|---|---|
| 1:1 | 1024x1024 | 1120 | 2048x2048 | 1120 | 4096x4096 | 2000 |
| 2:3 | 848x1264 | 1120 | 1696x2528 | 1120 | 3392x5056 | 2000 |
| 3:2 | 1264x848 | 1120 | 2528x1696 | 1120 | 5056x3392 | 2000 |
| 3:4 | 896x1200 | 1120 | 1792x2400 | 1120 | 3584x4800 | 2000 |
| 4:3 | 1200x896 | 1120 | 2400x1792 | 1120 | 4800x3584 | 2000 |
| 4:5 | 928x1152 | 1120 | 1856x2304 | 1120 | 3712x4608 | 2000 |
| 5:4 | 1152x928 | 1120 | 2304x1856 | 1120 | 4608x3712 | 2000 |
| 9:16 | 768x1376 | 1120 | 1536x2752 | 1120 | 3072x5504 | 2000 |
| 16:9 | 1376x768 | 1120 | 2752x1536 | 1120 | 5504x3072 | 2000 |
| 21:9 | 1584x672 | 1120 | 3168x1344 | 1120 | 6336x2688 | 2000 |

## Gemini 3.1 Flash Lite Image (Nano Banana 2 Lite)

**1K resolution only.** Supports `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.

## Gemini 2.5 Flash Image (legacy Nano Banana)

Fixed single-tier resolution per aspect ratio — no separate 1K/2K/4K selection.

| Aspect ratio | Resolution | Tokens |
|---|---|---|
| 1:1 | 1024x1024 | 1290 |
| 2:3 | 832x1248 | 1290 |
| 3:2 | 1248x832 | 1290 |
| 3:4 | 864x1184 | 1290 |
| 4:3 | 1184x864 | 1290 |
| 4:5 | 896x1152 | 1290 |
| 5:4 | 1152x896 | 1290 |
| 9:16 | 768x1344 | 1290 |
| 16:9 | 1344x768 | 1290 |
| 21:9 | 1536x672 | 1290 |

## Model selection cheat sheet

- **Nano Banana 2 (`gemini-3.1-flash-image`)** — default/go-to model: best all-around balance of speed, intelligence, and cost.
- **Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`)** — most efficient model in the family; ultra-low latency, cheapest, for high-volume/scale scenarios where you don't need multi-reference or multi-turn editing sophistication.
- **Nano Banana Pro (`gemini-3-pro-image`)** — professional asset production and complex instructions; real-world grounding via Search, always-on Thinking pass that refines composition before rendering, up to 4K.
- **Nano Banana (legacy, `gemini-2.5-flash-image`)** — optimized for speed/efficiency at 1K-class output; still functional but Google recommends migrating to Nano Banana 2 Lite for better quality/speed/price.

Always check `ai.google.dev/gemini-api/docs/pricing#<model-slug>` and the model's own capabilities page for current numbers before quoting a price to the user — these shift with new releases.
