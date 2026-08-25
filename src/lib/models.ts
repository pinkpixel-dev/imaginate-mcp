export interface ModelInfo {
  id: string;
  name: string;
  /** What this model is the right choice for. */
  bestFor: string;
  /** Capabilities and constraints a caller needs before picking it. */
  notes: string[];
}

export const OPENAI_IMAGE_MODELS: ModelInfo[] = [
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    bestFor: "Default choice. Highest quality and the most flexible output resolutions.",
    notes: [
      "Accepts near-arbitrary sizes, not only fixed presets. Max edge 3840px, both edges multiples of 16, long:short ratio at most 3:1.",
      "Always processes input images at high fidelity, so the input_fidelity parameter is not accepted.",
      "Does not support transparent backgrounds.",
      "Quality tiers: low, medium, high, auto.",
    ],
  },
  {
    id: "gpt-image-1.5",
    name: "GPT Image 1.5",
    bestFor: "Prior generation. Use when you need fixed size presets or transparent backgrounds.",
    notes: ["Fixed size presets only.", "Supports transparent backgrounds.", "Token-based output pricing."],
  },
  {
    id: "gpt-image-1",
    name: "GPT Image 1",
    bestFor: "Prior generation, kept for existing integrations.",
    notes: ["Fixed size presets only.", "Supports transparent backgrounds.", "Token-based output pricing."],
  },
  {
    id: "gpt-image-1-mini",
    name: "GPT Image 1 Mini",
    bestFor: "Cheapest OpenAI option. Drafts, thumbnails, and high-volume work.",
    notes: ["Fixed size presets only.", "Supports transparent backgrounds.", "Lowest cost per image of the OpenAI models."],
  },
];

export const GEMINI_IMAGE_MODELS: ModelInfo[] = [
  {
    id: "gemini-3.1-flash-image",
    name: "Nano Banana 2",
    bestFor: "Default choice. Best balance of speed, quality, and cost.",
    notes: [
      "Output up to 4K. Strong text rendering.",
      "Up to 10 high-fidelity object references plus up to 4 character-consistency references.",
      "Supports Google Search grounding and Google Image Search grounding.",
      "Supports thinking_level tuning (minimal or high).",
    ],
  },
  {
    id: "gemini-3-pro-image",
    name: "Nano Banana Pro",
    bestFor: "Professional asset production where brand and localization accuracy matter most.",
    notes: [
      "Highest world knowledge and the most precise creative control. Output up to 4K.",
      "Up to 6 high-fidelity object references, 5 character-consistency references, and 3 style references.",
      "Can return interleaved text and image output.",
    ],
  },
  {
    id: "gemini-3.1-flash-lite-image",
    name: "Nano Banana 2 Lite",
    bestFor: "Fastest and cheapest. High-volume generation at scale.",
    notes: [
      "1K resolution only.",
      "Up to 14 high-fidelity object references, but no character-consistency references.",
      "No Google Search grounding and no multi-turn editing optimization.",
    ],
  },
  {
    id: "gemini-2.5-flash-image",
    name: "Nano Banana (legacy)",
    bestFor: "Existing integrations pinned to the original model. Prefer Nano Banana 2 Lite for new work.",
    notes: ["Works best with 3 or fewer input images.", "Superseded on quality, speed, and price."],
  },
];

/** Renders a model catalog as markdown for the list tools. */
export function formatModelCatalog(title: string, models: ModelInfo[], defaultModel: string, footer: string[]): string {
  const lines: string[] = [`# ${title}`, "", `Default model for this server: \`${defaultModel}\``, ""];

  for (const model of models) {
    lines.push(`## ${model.name} (\`${model.id}\`)`);
    lines.push(model.bestFor);
    for (const note of model.notes) lines.push(`- ${note}`);
    lines.push("");
  }

  lines.push(...footer);
  return lines.join("\n").trimEnd();
}
