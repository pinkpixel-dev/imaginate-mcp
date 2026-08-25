# Prompting Guide for Nano Banana Image Generation

Full templates and sample prompts, pulled from the official Gemini image-generation prompting guide. Each pattern includes a reusable template and a filled-in example. Adapt these directly, or use them to teach the user the *shape* of a good prompt for a given goal.

## Generating images

### 1. Photorealistic scenes

Describe a scene in rich detail — the more specific, the more control over the result.

**Template:**
```
A photorealistic [type of shot] of a [subject description] in a [setting description]. [Description of the light]. Shot from a [camera angle] with a [lens type].
```

**Example prompt:**
```
A photorealistic wide-angle shot of a vibrant coral reef teeming with tropical fish. Crystal-clear turquoise water with sunbeams filtering down from the surface, illuminating a sea turtle gliding gracefully over the coral. Shot from a low perspective with a wide-angle lens. Aspect ratio 16:9.
```

```python
interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input="A photorealistic wide-angle shot of a vibrant coral reef teeming with tropical fish. Crystal-clear turquoise water with sunbeams filtering down from the surface, illuminating a sea turtle gliding gracefully over the coral. Shot from a low perspective with a wide-angle lens. Aspect ratio 16:9.",
    response_format={"type": "image", "mime_type": "image/jpeg", "aspect_ratio": "16:9"},
)
```

### 2. Stylized illustrations & stickers

Describe the artistic style, subject, and medium. Be specific about visual qualities (bold lines, cel-shading, palette) for consistent results.

**Template:**
```
A [style] of a [subject, with details about accessories or actions] doing [activity]. The design features [visual qualities, e.g., bold outlines, cel-shading] and [color/background preference].
```

**Example prompt:**
```
A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It's munching on a green bamboo leaf. The design features bold, clean outlines, simple cel-shading, and a vibrant color palette. The background must be white.
```

### 3. Accurate text in images

Gemini is strong at rendering legible text. Be explicit about the exact text, the font style (described, not named), and the overall design. Use Nano Banana Pro for professional-grade text-heavy assets.

**Template:**
```
Create a [image type] for [brand/concept] with the text "[text to render]" in a [font style]. The design should be [style description], with a [color scheme].
```

**Example prompt:**
```
Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way.
```

**Tip:** when generating text as *part of* a larger image, ask the model to work out the text first, then request the full image with that text rendered in — this improves accuracy vs. asking for everything at once.

### 4. Product mockups & commercial photography

Great for clean e-commerce/advertising/branding shots.

**Template:**
```
A high-resolution, studio-lit product photograph of a [product description] on a [background surface/description]. The lighting is a [lighting setup, e.g., three-point softbox setup] to [lighting purpose]. The camera angle is a [angle type] to showcase [specific feature]. Ultra-realistic, with sharp focus on [key detail]. [Aspect ratio].
```

**Example prompt:**
```
A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug in matte black, presented on a polished concrete surface. The lighting is a three-point softbox setup designed to create soft, diffused highlights and eliminate harsh shadows. The camera angle is a slightly elevated 45-degree shot to showcase its clean lines. Ultra-realistic, with sharp focus on the steam rising from the coffee. Square image.
```

### 5. Minimalist & negative-space design

Good for backgrounds meant to have text/UI overlaid later (marketing materials, website heroes, slide backgrounds).

**Template:**
```
A minimalist composition featuring a single [subject] positioned in the [bottom-right/top-left/etc.] of the frame. The background is a vast, empty [color] canvas, creating significant negative space. Soft, subtle lighting. [Aspect ratio].
```

**Example prompt:**
```
A minimalist composition featuring a single, delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty off-white canvas, creating significant negative space for text. Soft, diffused lighting from the top left. Square image.
```

### 6. Sequential art (comic panels / storyboards)

Builds on character consistency + scene description for visual storytelling. Works best with Nano Banana Pro and Nano Banana 2 for text accuracy and narrative sense.

**Template:**
```
Make a [N] panel comic in a [style]. Put the character in a [type of scene].
```

**Example prompt (with a reference image of the character):**
```
Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humorous scene.
```

### 7. Grounding with Google Search

Use for imagery that depends on recent/real-time information — news, weather, sports scores, current events.

**Example prompt:**
```
Make a simple but stylish graphic of last night's Arsenal game in the Champions League.
```

```python
interaction = client.interactions.create(
    model="gemini-3.1-flash-image",
    input="Make a simple but stylish graphic of last night's Arsenal game in the Champions League",
    tools=[{"type": "google_search"}],
    response_format={"type": "image", "aspect_ratio": "16:9"},
)
```

---

## Editing images

### 1. Adding and removing elements

Provide an image and describe the change. The model matches the original's style, lighting, and perspective.

**Template:**
```
Using the provided image of [subject], please [add/remove/modify] [element] to/from the scene. Ensure the change is [description of how the change should integrate].
```

**Example prompt:**
```
Using the provided image of my cat, please add a small, knitted wizard hat on its head. Make it look like it's sitting comfortably and matches the soft lighting of the photo.
```

### 2. Inpainting (semantic masking)

No literal pixel mask needed — describe the target region in words and Gemini treats everything else as fixed.

**Template:**
```
Using the provided image, change only the [specific element] to [new element/description]. Keep everything else in the image exactly the same, preserving the original style, lighting, and composition.
```

**Example prompt:**
```
Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa. Keep the rest of the room, including the pillows on the sofa and the lighting, unchanged.
```

### 3. Style transfer

Recreate a photo's content in a different artistic style while preserving composition.

**Template:**
```
Transform the provided photograph of [subject] into the artistic style of [artist/art style]. Preserve the original composition but render it with [description of stylistic elements].
```

**Example prompt:**
```
Transform the provided photograph of a modern city street at night into the artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original composition of buildings and cars, but render all elements with swirling, impasto brushstrokes and a dramatic palette of deep blues and bright yellows.
```

### 4. Advanced composition: combining multiple images

Provide several images as context and ask the model to build a new composite scene from elements across them. Great for product mockups and collages. Check the model's reference-image limits (see SKILL.md table) before assuming you can pass all 14 at once.

**Template:**
```
Create a new image by combining the elements from the provided images. Take the [element from image 1] and place it with/on the [element from image 2]. The final image should be a [description of the final scene].
```

**Example prompt:**
```
Create a professional e-commerce fashion photo. Take the blue floral dress from the first image and let the woman from the second image wear it. Generate a realistic, full-body shot of the woman wearing the dress, with the lighting and shadows adjusted to match the outdoor environment.
```

### 5. High-fidelity detail preservation

When a face, logo, or other critical detail must survive an edit untouched, describe it in detail and explicitly say what must not change.

**Template:**
```
Using the provided images, place [element from image 2] onto [element from image 1]. Ensure that the features of [element from image 1] remain completely unchanged. The added element should [description of how the element should integrate].
```

**Example prompt:**
```
Take the first image of the woman with brown hair, blue eyes, and a neutral expression. Add the logo from the second image onto her black t-shirt. Ensure the woman's face and features remain completely unchanged. The logo should look like it's naturally printed on the fabric, following the folds of the shirt.
```

### 6. Bring something to life (sketch-to-final)

Upload a rough sketch and ask the model to render it as a finished piece while keeping specified structural features.

**Template:**
```
Turn this rough [medium] sketch of a [subject] into a [style description] photo. Keep the [specific features] from the sketch but add [new details/materials].
```

**Example prompt:**
```
Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting.
```

### 7. Character consistency: 360° views

Generate multiple angles of the same character/subject by iteratively prompting different views. Feed previously generated outputs back in as reference images for best consistency; for complex poses, include a reference image of the desired pose.

**Template:**
```
A studio portrait of [person] against [background], [looking forward/in profile looking right/etc.]
```

**Example prompt:**
```
A studio portrait of this man against white, in profile looking right
```

---

## Best practices (cross-cutting)

- **Be hyper-specific.** Instead of "fantasy armor," write "ornate elven plate armor, etched with silver leaf patterns, with a high collar and pauldrons shaped like falcon wings."
- **State intent, not just content.** "Create a logo for a high-end, minimalist skincare brand" beats "Create a logo" — the model's grasp of *purpose* shapes composition choices.
- **Iterate conversationally.** Don't expect a perfect first result. Follow up with "keep everything the same, but make the lighting warmer" style refinements, ideally chained via `previous_interaction_id`.
- **Break complex scenes into steps.** "First, create a misty forest at dawn. Then add a moss-covered stone altar in the foreground. Finally, place a glowing sword on the altar."
- **Use semantic negatives.** Instead of "no cars," describe the intended positive state: "an empty, deserted street with no signs of traffic."
- **Control the camera with photographic language.** `wide-angle shot`, `macro shot`, `low-angle perspective`, `three-point softbox`, etc. — cinematic/photography vocabulary reliably steers composition.
