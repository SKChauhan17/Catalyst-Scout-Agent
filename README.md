# Catalyst Scout

<p align="center">
  <img src=".github/assets/readme-hero.svg" alt="Catalyst Scout Hero" width="800">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-141413?style=for-the-badge&logo=next.js&labelColor=141413&color=e8e6dc" alt="Next.js 16">
  <img src="https://img.shields.io/badge/LangGraph_AI-141413?style=for-the-badge&logo=langchain&labelColor=141413&color=e8e6dc" alt="LangGraph">
  <img src="https://img.shields.io/badge/Supabase_Vector-141413?style=for-the-badge&logo=supabase&labelColor=141413&color=e8e6dc" alt="Supabase">
  <img src="https://img.shields.io/badge/Upstash_QStash-141413?style=for-the-badge&logo=upstash&labelColor=141413&color=e8e6dc" alt="Upstash">
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#features">Features</a> •
  <a href="#local-setup">Local Setup</a> •
  <a href="#module-docs">Module Docs</a>
</p>

---

## Overview

**Catalyst Scout** is a zero-compromise, AI-powered talent scouting agent designed for high-stakes recruiting. By combining high-density vector retrieval with a robust 9-tier "immortal" LLM waterfall and background orchestration, it provides deterministic, high-availability candidate screening that never times out and never fails.

> [!IMPORTANT]
> This system is built for resilience. If an LLM tier fails or rate limits, the agent automatically falls back to secondary and tertiary providers within milliseconds, ensuring 100% mission completion.

---

## Architecture

The system operates as a distributed state machine, decoupling the frontend mission control from the background agentic reasoning.

```text
┌────────────────┐      ┌────────────────┐      ┌──────────────────┐
│   Frontend     │─────▶│  Next.js API   │─────▶│  Upstash QStash  │
│  (Mission Ctrl)│      │  (/api/scout)  │      │  (Task Queue)    │
└───────▲────────┘      └────────────────┘      └─────────┬────────┘
        │                                                 │
        │               ┌────────────────┐      ┌─────────▼────────┐
        │               │  9-Tier LLM    │      │  Next.js Worker  │
        └───────────────┤   Waterfall    │◀─────┤  (/api/worker)   │
      (Realtime         └────────────────┘      └─────────┬────────┘
       WebSockets)              ▲                         │
                                │               ┌─────────▼────────┐
                                └───────────────┤   Supabase DB    │
                                                │   (Vector/Logs)  │
                                                └──────────────────┘
```

---

## Features

| Feature | Description |
| :--- | :--- |
| **JD Parsing** | High-precision extraction of mandatory/optional skills and budget from raw text. |
| **Hybrid Search** | Combined pgvector cosine similarity and semantic filtering for internal & BYOD datasets. |
| **Simulated Interviews** | Dynamic 3-turn recruiter/candidate simulations to gauge intent and enthusiasm. |
| **9-Tier Waterfall** | An "immortal" LLM router spanning Groq, SambaNova, and OpenRouter for 100% uptime. |
| **Real-time Recovery** | WebSocket terminal state that survives refreshes via persistent Postgres log re-streaming. |

---

## Module Docs

Detailed technical documentation for core subsystems:

| Module | Description | Link |
| :--- | :--- | :--- |
| **Agent Logic** | LangGraph state machine, nodes, and scoring logic. | [lib/agent/README.md](lib/agent/README.md) |
| **Background Worker** | QStash handshake, execution security, and rate limiting. | [app/api/worker/README.md](app/api/worker/README.md) |
| **UI Components** | Mission control dashboard, real-time terminal, and design system. | [components/README.md](components/README.md) |

---

## Local Setup

### 1. Prerequisites
- **pnpm** (strictly enforced)
- Supabase Project (with `pgvector` enabled)
- Upstash Account (for QStash & Redis)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/SKChauhan17/Catalyst-Scout-Agent.git
cd Catalyst-Scout-Agent

# Install dependencies
pnpm install
```

### 3. Environment Setup
Create a `.env.local` file with the following keys:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
# LLM Provider Keys
GROQ_API_KEY=...
SAMBANOVA_API_KEY=...
OPENROUTER_API_KEY=...
```

### 4. Run Development
```bash
pnpm dev
```

### Command Palette

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Start development server |
| `pnpm build` | Production build and type check |
| `pnpm lint` | Run ESLint security & style audit |
| `pnpm db:seed` | Seed Supabase with 100 synthetic profiles |

---

## Live Deployment & Demo
- **Live App:** [Coming Soon]
- **Video Guide:** [Coming Soon]

---

<p align="center">
  Built with precision for the Catalyst Hackathon.
</p>
