# imaginate-mcp

An MCP server that generates and edits images with OpenAI GPT Image and Google Gemini (Nano Banana). It runs over stdio, saves every image to disk, and hands back the file path so your assistant can keep working with the result.

## What you get

Six tools, split by provider:

| Tool | What it does |
| --- | --- |
| `openai_generate_image` | Text to image with GPT Image models |
| `openai_edit_image` | Edit one image, inpaint with a mask, or compose several references |
| `openai_list_image_models` | Model IDs, strengths, and limits |
| `gemini_generate_image` | Text to image with Nano Banana models, with optional Google Search grounding |
| `gemini_edit_image` | Edit, style transfer, semantic inpainting, or multi-image composition |
| `gemini_list_image_models` | Model IDs, reference image limits, and resolution tiers |

Only the tools for the keys you configure get registered. If you set `OPENAI_API_KEY` and nothing else, your assistant sees three tools and none of them can fail on a missing Google key. That was the main reason for splitting the tools by provider instead of using one tool with a `provider` argument.

## Requirements

- Node.js 20 or newer
- An OpenAI API key, a Gemini API key, or both

GPT Image models need OpenAI API organization verification. If you have not done that, OpenAI rejects the request and the server tells you so.

## Connect

Run the published package with `npx`. You do not need to clone the repository or install the package globally.

```bash
npx -y @pinkpixel/imaginate-mcp
```

Add the server to your client's config. For Claude Desktop, edit `claude_desktop_config.json`. For Claude Code, use `.mcp.json` in your project or your user settings.

```json
{
  "mcpServers": {
    "imaginate": {
      "command": "npx",
      "args": ["-y", "@pinkpixel/imaginate-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "GEMINI_API_KEY": "...",
        "IMAGINATE_OUTPUT_DIR": "~/Pictures/imaginate"
      }
    }
  }
}
```

Restart the client after you edit the config. If no image tools appear, call `imaginate_setup_help`. That tool only exists when no provider key was found, and it lists the variables you still need to set.

## Run from source

Clone and build the repository if you want to work on the server locally:

```bash
git clone https://github.com/pinkpixel-dev/imaginate-mcp.git
cd imaginate-mcp
npm install
npm run build
node dist/index.js
```

To connect an MCP client to this build, use `"command": "node"` and set `args` to the absolute path of `dist/index.js`.

## Configuration

Every variable is read once at startup, so restart the client after you change one.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | One key required | none | Registers the `openai_*` tools |
| `GEMINI_API_KEY` | One key required | none | Registers the `gemini_*` tools. `GOOGLE_API_KEY` also works |
| `IMAGINATE_OUTPUT_DIR` | no | `~/Pictures/imaginate` | Where images are saved. A leading `~` is expanded |
| `IMAGINATE_OPENAI_MODEL` | no | `gpt-image-2` | Model used when a call does not name one |
| `IMAGINATE_GEMINI_MODEL` | no | `gemini-3.1-flash-image` | Model used when a call does not name one |
| `OPENAI_BASE_URL` | no | OpenAI's default | Point at an OpenAI-compatible proxy |

Any tool call can override the output directory with `output_dir` and the file name with `filename`.

## How the files work

Images go to the output directory. The server never overwrites anything. A file named `cat.png` that already exists becomes `cat-1.png`, then `cat-2.png`.

Default names look like `openai-a-red-fox-20260825-134512-071.png`. That is the provider prefix, a slug of your prompt, and a timestamp. Pass `filename` if you want something specific.

Source images for edits must be local files. Pass absolute paths. The tools do not download remote URLs, so fetch the file first if it lives on the web. Source files are read only and never modified.

## Using it

Once the server is connected you mostly talk to your assistant normally. A few things worth knowing.

### Picking a provider

Both providers are good, at different things.

Gemini is stronger on text inside images, world knowledge, and infographic work, and it can ground on live Google Search results before it draws. It also returns an interaction ID, so you can keep refining an image without uploading it again.

GPT Image follows detailed layout instructions well and gives you fine control over size, quality, and background. It is the one to use when you need a transparent background, though for that you need `gpt-image-1.5` or older because `gpt-image-2` dropped it.

### Iterating on a Gemini image

Every Gemini result includes an interaction ID. Pass it back as `previous_interaction_id` on the next `gemini_edit_image` call and skip re-sending the image:

1. `gemini_generate_image` with your prompt. The result includes an interaction ID.
2. `gemini_edit_image` with `previous_interaction_id` and a prompt like "make it landscape."

This is cheaper than re-uploading and keeps the image more consistent between rounds.

### Editing and composing

Both `*_edit_image` tools handle several jobs through the same interface. Pass one image path to edit that image. Pass several to combine them into a new scene.

For masked inpainting the two providers differ. OpenAI wants a real mask PNG with an alpha channel, passed as `mask`. Gemini does it semantically, so you just say "change only the sky and keep everything else exactly the same" and skip the mask file.

Reference image limits depend on the Gemini model: 14 on Lite, 10 on Nano Banana 2, 6 on Pro. Call `gemini_list_image_models` if you are not sure.

## Development

```bash
npm run build      # compile to dist/
npm run watch      # compile on change
npm run typecheck  # types only, no output
npm test           # compile tests and run them
```

Tests use the built-in Node test runner. They cover the file naming and saving logic, the Gemini response parsing, and the error message mapping. They do not call either API, so you can run them without keys.

The layout:

```
src/
  index.ts               entry point, conditional tool registration
  config.ts              environment parsing
  lib/                   file handling, errors, result formatting, model catalog
  providers/openai/      OpenAI client wrapper and tool definitions
  providers/google/      Gemini client wrapper and tool definitions
tests/
```

## Limitations

- Source images must be local files. No remote URLs.
- Streaming and partial images are not wired up. A call returns when the image is done.
- Gemini does not reliably honor a requested image count, so ask for one image per call. The OpenAI tools take `n` and that works normally.
- OpenAI can take up to two minutes on a complex prompt. That is the API, not the server.
- Every Gemini image carries an invisible SynthID watermark.
- Model IDs and pricing move fast on both providers. The list tools describe what this version knows about, which may drift from what your account can actually reach.

## License

Apache 2.0. See [LICENSE](LICENSE).

Made with 💖 by [Pink Pixel](https://pinkpixel.dev)
