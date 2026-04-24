# UI/UX Architecture & Design System - Catalyst Scout

## 1. Visual Theme & Atmosphere
Catalyst Scout operates on a dark-mode-native canvas that channels the aesthetic of a premium code editor merged with an AI command center. The design relies on darkness as the native medium, where information density is managed through subtle gradations of white opacity rather than heavy color variation. 

Every element exists in a carefully calibrated hierarchy. We utilize the extreme structural minimalism of Vercel, treating the interface like a compiler treats code—stripping away unnecessary tokens until only structure remains. To signal AI activity and success, we inject the "power on" visual metaphor of VoltAgent using a singular, surgical emerald green accent.

## 2. Color Palette & Roles (Tailwind Tokens)
The system is built entirely on achromatic dark surfaces, utilizing translucent white borders and a single chromatic brand accent.

### Surfaces & Backgrounds
* **Abyss Black (`#050507`):** The deepest background for the main viewport. It is a near-pure black with a faint warm undertone that provides maximum contrast for green accents.
* **Panel Dark (`#0f1011`):** Used for sidebar and input panel backgrounds, stepping up one level of luminance from Abyss Black.
* **Translucent Surface (`rgba(255,255,255,0.02)` to `0.04`):** Used for elevated cards and candidate profiles.

### Text & Typography
* **Primary Text (`#f7f8f8`):** Near-white with a barely-warm cast, preventing eye strain on dark backgrounds while maintaining high contrast.
* **Secondary Text (`#8b949e`):** A cool blue-gray slate for metadata, timestamps, and de-emphasized content.

### Brand, AI Accents & Status
* **Emerald Signal Green (`#00d992`):** The core brand energy, used for AI glow effects, successful Match Scores, and active borders.
* **VoltAgent Mint (`#2fd6a1`):** The button-text variant of the brand green, used specifically for primary CTA text on dark surfaces.
* **Supabase Green (`#3ecf8e`):** Used sparingly as a secondary identity marker for subtle green border accents.

### Borders & Containment
* **Border Subtle (`rgba(255,255,255,0.05)`):** The default ultra-thin, semi-transparent white border for clean structure.
* **Border Standard (`rgba(255,255,255,0.08)`):** The standard border for elevated candidate cards and active input blocks.

## 3. Typography Rules
We employ a triple-font system to achieve varying layers of authority and precision.

### Font Families
1.  **Headings (The Announcer):** `Geist Sans`. Enables OpenType `"liga"` globally for structural, efficient glyph combinations.
2.  **Body & UI (The Workhorse):** `Inter Variable`. Must have OpenType features `"cv01"` and `"ss03"` enabled globally to provide a cleaner, more geometric appearance.
3.  **Data & Code (The Console):** `Geist Mono`. Used for the AI agent execution logs, extracted JSON schema displays, and Match/Interest scores.

### Hierarchy & Spacing
* **Display / Hero:** Geist Sans. Use aggressive negative letter-spacing (-2.4px to -2.88px at 48px) to create compressed, engineered text blocks. Compress the line-height to an absolute zero leading (1.00) to mimic dense terminal commands. 
* **UI / Navigation:** Inter Variable. Use weight 510 (between regular and medium) as the default emphasis weight to create subtle hierarchy without heavy shouting.
* **Technical Labels:** Geist Mono. Rendered at 12px, weight 500, uppercase, with 1.2px letter-spacing to create the "developer console" voice.

## 4. Component Stylings

### Buttons
* **Primary Action (The "Scout" CTA):** Pill shape (9999px radius) for maximum hierarchy. Background is `#0f0f0f`, text is VoltAgent Mint (`#2fd6a1`), surrounded by a 1px solid white border (`#fafafa`). 
* **Secondary / Ghost Buttons:** Transparent background, `1px solid rgba(255,255,255,0.08)` border, 6px radius, with `#f7f8f8` text.

### Cards & Candidate Profiles
* **Background:** Never solid. Use `rgba(255,255,255,0.02)`.
* **Border:** `1px solid rgba(255,255,255,0.08)`.
* **Radius:** 8px standard for content cards. 
* **AI Reasoning Trigger:** If a candidate is highly ranked, apply a subtle Green Signal Glow `drop-shadow(0 0 2px #00d992)` to the card's edge.

### Agent Execution Terminal
* When LangGraph is running, stream the logs into a dedicated container.
* Background: Carbon Surface (`#101010`).
* Font: `Geist Mono`, 13px. 
* Status Indicators: Use small pill badges (9999px) with tinted backgrounds for active graph nodes.

## 5. Depth & Elevation Philosophy
* **No Drop Shadows on Dark:** Traditional drop shadows are nearly invisible on dark backgrounds. Elevation is strictly communicated through background luminance steps (e.g., `0.02` to `0.04` white opacity) and semi-transparent borders.
* **The Inset Technique:** For the raw JSON or code displays, use an inset shadow (`rgba(0,0,0,0.2) 0px 0px 12px 0px inset`) to create a "sunken" dimensional depth for recessed panels.

## 6. AI Agent Execution Directives
When generating React/Next.js components, you MUST adhere to the following Tailwind mapping:
* Use `bg-[#050507]` for the main `layout.tsx` background.
* Use `font-sans tracking-[-0.04em] leading-none` for all major display headings.
* Apply `border border-white/5` or `border border-white/10` for card boundaries. NEVER use default `border-gray-800`.
* Ensure all typography classes explicitly map to the weights defined above (e.g., `font-[510]` for Inter).