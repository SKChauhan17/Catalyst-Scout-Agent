# LLM Router Subsystem

<p align="center">
  <img src="../../.github/assets/llm-hero.svg" alt="LLM Hero" width="800">
</p>

## Overview
The "Immortal" LLM Router is the crowning achievement of Catalyst Scout. It ensures that the agentic mission never fails due to provider downtime, rate limits (TPM/RPM), or transient network errors.

## The 9-Tier Waterfall
We utilize a time-sliced, multi-provider fallback strategy. Each tier is specifically chosen to bypass the quotas of the previous one while maintaining a balance between speed and reasoning.

### ASCII Flow: Time-Sliced Execution
```text
[Mission Start]
      │
      ▼
┌─────────────┐  < 1.5s  ┌─────────────┐
│ Tier 1:     │─────────▶│ Tier 2:     │
│ SambaNova   │  FAIL    │ Groq        │
└─────────────┘          └─────────────┘
      │                        │
      │ 1.5s Timeout           │ 1.5s Timeout
      ▼                        ▼
┌─────────────┐          ┌─────────────┐
│ Tier 3:     │          │ Tier 4:     │
│ Groq Llama  │          │ SambaNova   │
└─────────────┘          └─────────────┘
      │                        │
      ▼────────────────────────▼
      │
      ▼  > 6.0s Powerhouse Jump
┌──────────────────────────────────────┐
│ Tier 5-8: OpenRouter (Claude/GPT)    │
│ High-reliability reasoning pool      │
└──────────────────────────────────────┘
      │
      ▼  > 10.0s Emergency Jump
┌──────────────────────────────────────┐
│ Tier 9: Deterministic Heuristic      │
│ Zero-LLM fallback logic              │
└──────────────────────────────────────┘
```

## Provider Distribution

| Tier | Provider | Model | Logic |
| :--- | :--- | :--- | :--- |
| **1** | SambaNova | Llama 3.3 70B | Ultra-low latency primary. |
| **2-4** | Groq | Llama 3 70B | Secondary low-latency group. |
| **5-6** | OpenRouter | Claude 3.5 Sonnet | High-fidelity reasoning fallback. |
| **7-8** | OpenRouter | GPT-4o / o1-mini | Tertiary reasoning pool. |
| **9** | Local | Heuristic | Hard-coded retrieval logic for 100% survival. |

## Implementation
The logic resides in `lib/llm/router.ts`. It utilizes a recursive retry mechanism that tracks elapsed time and jumps tiers dynamically if a provider is unresponsive, ensuring the user is never stuck on a loading spinner.
