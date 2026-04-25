# Agent Logic Subsystem

<p align="center">
  <img src="../../.github/assets/agent-hero.svg" alt="Agent Hero" width="800">
</p>

## Overview
The "Brain" of Catalyst Scout is a stateful directed acyclic graph (DAG) built with **LangGraph.js**. It orchestrates the flow from raw Job Description parsing to final candidate ranking.

## The 9-Tier LLM Waterfall
To ensure zero failures, we implement a time-sliced fallback router:
1. **Tier 1-4 (Latency Optimized):** Groq / SambaNova (Llama 3.3 70B). If sub-second response fails or rate limits, jump to next.
2. **Tier 5-8 (Reasoning Optimized):** OpenRouter (Claude 3.5 Sonnet / GPT-4o).
3. **Tier 9 (Safety Net):** Deterministic heuristic fallback.

## Graph Nodes

| Node | Responsibility | Provider |
| :--- | :--- | :--- |
| `parseJD` | Extracts structured JSON from raw JD text. | LLM Router |
| `retrieveMatch` | Hybrid vector search (Supabase) + BYOD filtering. | pgvector / Local Embedding |
| `simulateChat` | High-fidelity 3-turn candidate interview. | Groq (Llama 3) |
| `rankCandidates` | Final scoring matrix (60% Match, 40% Interest). | LLM Scorer |

## State Management
The `AgentState` is strictly typed and persisted across the execution lifecycle, allowing the background worker to resume or retry nodes if an intermittent failure occurs.
