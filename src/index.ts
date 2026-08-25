#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { textResult } from "./lib/result.js";
import { registerOpenAITools } from "./providers/openai/tools.js";
import { registerGoogleTools } from "./providers/google/tools.js";

const SERVER_NAME = "imaginate-mcp";
const SERVER_VERSION = "0.1.0";

const MISSING_KEYS_MESSAGE = [
  `${SERVER_NAME} started with no image provider configured, so it has no tools to offer.`,
  "",
  "Set at least one API key in the server environment and restart:",
  "  OPENAI_API_KEY  enables the openai_* tools (GPT Image)",
  "  GEMINI_API_KEY  enables the gemini_* tools (Nano Banana). GOOGLE_API_KEY also works.",
].join("\n");

async function main(): Promise<void> {
  const config = loadConfig();

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Generates and edits images with OpenAI GPT Image and Google Gemini (Nano Banana). " +
        "Images are written to disk and the tools return absolute file paths, so feed a returned path " +
        "straight back into an edit tool to keep iterating. Only the tools for configured API keys are " +
        "registered, so whichever image tools you can see are the ones that will work.",
    },
  );

  const enabled: string[] = [];

  if (config.openai) {
    registerOpenAITools(server, config.openai, config.outputDir);
    enabled.push("OpenAI");
  }

  if (config.google) {
    registerGoogleTools(server, config.google, config.outputDir);
    enabled.push("Gemini");
  }

  // With no provider registered the server would expose no tools at all, and
  // clients get a bare "Method not found" from tools/list. A help tool turns
  // that dead end into an answer.
  if (enabled.length === 0) {
    registerSetupHelp(server);
  }

  // stderr is the only safe place to log: stdout carries the MCP protocol itself.
  if (enabled.length === 0) {
    console.error(MISSING_KEYS_MESSAGE);
  } else {
    console.error(`${SERVER_NAME} ready. Providers: ${enabled.join(", ")}. Output directory: ${config.outputDir}`);
  }

  await server.connect(new StdioServerTransport());
}

/** Explains the missing configuration when no provider key is present. */
function registerSetupHelp(server: McpServer): void {
  server.registerTool(
    "imaginate_setup_help",
    {
      title: "Imaginate setup help",
      description: `Explain why this server currently has no image generation tools and how to enable them.

This tool only exists when no image provider API key is configured. Call it if you expected image generation tools and cannot find any.

Args: none.

Returns: The environment variables to set and where to set them.`,
      inputSchema: z.object({}).strict().shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () =>
      textResult(
        `${MISSING_KEYS_MESSAGE}\n\n` +
          "Set these in the MCP client's server configuration (the 'env' block for this server) " +
          "and restart the client. The image tools appear once at least one key is present.",
      ),
  );
}

main().catch((error: unknown) => {
  console.error(`${SERVER_NAME} failed to start:`, error instanceof Error ? error.message : error);
  process.exit(1);
});
