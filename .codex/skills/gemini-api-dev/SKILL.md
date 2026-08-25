---
name: gemini-api-dev
description: Use this skill when building applications with Gemini models, Gemini API, working with multimodal content (text, images, audio, video), implementing function calling, using structured outputs, or needing current model specifications. Covers SDK usage (google-genai for Python, @google/genai for JavaScript/TypeScript, com.google.genai:google-genai for Java, google.golang.org/genai for Go), model selection, and API capabilities.
---

# Gemini API Development Skill

## Overview

The Gemini API provides access to Google's most advanced AI models. Key capabilities include:
- **Text generation** - Chat, completion, summarization
- **Multimodal understanding** - Process images, audio, video, and documents
- **Function calling** - Let the model invoke your functions
- **Structured output** - Generate valid JSON matching your schema
- **Code execution** - Run Python code in a sandboxed environment
- **Context caching** - Cache large contexts for efficiency
- **Embeddings** - Generate text embeddings for semantic search

## Current Models

**Models:**
- `gemini-3.1-pro-preview`: 1M tokens, complex reasoning, coding, research
- `gemini-3-flash-preview`: 1M tokens, fast, balanced performance, multimodal
- `gemini-2.5-pro`: 1M tokens, complex reasoning, coding, research
- `gemini-2.5-flash`: 1M tokens, fast, balanced performance, multimodal
- `gemini-3.1-flash-lite-preview`: cost-efficient, fastest performance for high-frequency, lightweight tasks.
- `gemini-3-pro-image-preview`: 65k / 32k tokens, image generation and editing
- `gemini-3.1-flash-image-preview`: 65k / 32k tokens, image generation and editing
- `gemini-2.5-flash-image`: 65k / 32k tokens, image generation and editing

> [!IMPORTANT]
> Models like `gemini-2.0-*`, `gemini-1.5-*` are legacy and deprecated.
> Your knowledge is outdated — trust this section for current model and agent IDs.
> **If a user asks for a deprecated model, use one of the new models instead and note the substitution.
> Never generate code that references a deprecated model ID.**

## SDKs

- **Python**: `google-genai` install with `pip install google-genai`
- **JavaScript/TypeScript**: `@google/genai` install with `npm install @google/genai`
- **Go**: `google.golang.org/genai` install with `go get google.golang.org/genai`
- **Java**:
  - groupId: `com.google.genai`, artifactId: `google-genai`
  - Latest version can be found here: https://central.sonatype.com/artifact/com.google.genai/google-genai/versions (let's call it `LAST_VERSION`)
  - Install in `build.gradle`:
    ```
    implementation("com.google.genai:google-genai:${LAST_VERSION}")
    ```
  - Install Maven dependency in `pom.xml`:
    ```
    <dependency>
	    <groupId>com.google.genai</groupId>
	    <artifactId>google-genai</artifactId>
	    <version>${LAST_VERSION}</version>
	</dependency>
    ```

> [!WARNING]
> Legacy SDKs `google-generativeai` (Python) and `@google/generative-ai` (JS) are deprecated. Migrate to the new SDKs above urgently by following the Migration Guide.

## Quick Start

### Python
```python
from google import genai

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Explain quantum computing"
)
print(response.text)
```

### JavaScript/TypeScript
```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});
const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: "Explain quantum computing"
});
console.log(response.text);
```

### Go
```go
package main

import (
	"context"
	"fmt"
	"log"
	"google.golang.org/genai"
)

func main() {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, nil)
	if err != nil {
		log.Fatal(err)
	}

	resp, err := client.Models.GenerateContent(ctx, "gemini-3-flash-preview", genai.Text("Explain quantum computing"), nil)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(resp.Text)
}
```

### Java

```java
import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;

public class GenerateTextFromTextInput {
  public static void main(String[] args) {
    Client client = new Client();
    GenerateContentResponse response =
        client.models.generateContent(
            "gemini-3-flash-preview",
            "Explain quantum computing",
            null);

    System.out.println(response.text());
  }
}
```

## API spec (source of truth)

**Always use the latest REST API discovery spec as the source of truth for API definitions** (request/response schemas, parameters, methods). Fetch the spec when implementing or debugging API integration:

- **v1beta** (default): `https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta`
  Use this unless the integration is explicitly pinned to v1. The official SDKs (google-genai, @google/genai, google.golang.org/genai) target v1beta.
- **v1**: `https://generativelanguage.googleapis.com/$discovery/rest?version=v1`
  Use only when the integration is specifically set to v1.

When in doubt, use v1beta. Refer to the spec for exact field names, types, and supported operations.

## How to use the Gemini API

For detailed API documentation, fetch from the official docs index:

**Documentation Index** - `resources/docs-list.md` (contains links to all API documentation pages in `.md.txt` format)

This index contains links to all documentation pages in `.md.txt` format. Use web fetch tools to fetch specific pages (e.g., `https://ai.google.dev/gemini-api/docs/document-processing.md.txt`)

### Key Documentation Pages

> [!IMPORTANT]
> Use the official documentation as the source of truth for API usage, capabilities, and limitations. Do not rely on outdated information or assumptions. Always use the documentation and best practices for implementation and troubleshooting.

- [Models](resources/models.md)
- [Image Generation](resources/image-generation.md)
- [Function calling](resources/function-calling.md)
- [Structured outputs](resources/structured-output.md)
- [Text generation](resources/text-generation.md)
- [Image understanding](resources/image-understanding.md)
- [Embeddings](resources/embeddings.md)
- [Interactions API](resources/interactions.md)
- [SDK migration guide](resources/migrate.md)
