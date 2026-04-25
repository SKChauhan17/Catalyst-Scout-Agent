# Catalyst Scout - Master Execution Ledger
**Deadline:** Monday, April 27, 1:00 AM IST 
**Objective:** Zero-compromise AI-Powered Talent Scouting Agent

> **AI Agent Directive:** You must check off these boxes `[x]` as you complete them. You are strictly forbidden from moving to a new phase until the current phase is fully checked off, micro-committed, pushed, merged into `main`, and a new branch is checked out. 
> 
> *STRICT RULE:* Use `pnpm` exclusively. Never use `npm` or `yarn`.

---

## Phase 1: Foundation & The Data Engine ✅
**Branch:** `git checkout -b phase-1-database`
**Goal:** Establish Supabase, pgvector, and the 100-profile seed dataset.

- [x] **1.1 Supabase Setup**
  - [x] Initialize Supabase client in `lib/db/supabase.ts`.
  - [x] Create `supabase/migrations/` directory.
  - [x] Write SQL migration to enable `pgvector` extension.
- [x] **1.2 Schema Definition**
  - [x] Create `jobs` table (id, raw_text, parsed_requirements jsonb, created_at).
  - [x] Create `candidates` table (id, name, skills jsonb, location, salary_expectation, system_prompt_persona, embedding vector(384)).
  - [x] Create `evaluations` table (candidate_id, job_id, match_score, interest_score, chat_transcript jsonb).
- [x] **1.3 Row Level Security (RLS)**
  - [x] Write SQL to enforce RLS on all tables (Service Role bypass for backend, anon read-only for frontend).
- [x] **1.4 The Seed Script (Over-Delivery)**
  - [x] Create Node.js script to generate 100 mock candidate profiles.
  - [x] Integrate SambaNova Cloud (Meta-Llama-3.3-70B) to generate realistic `system_prompt_persona` for each candidate.
  - [x] Integrate `@xenova/transformers` (Supabase/gte-small) to generate 384-dimensional vectors for each candidate.
  - [x] Execute seed script and verify 100 records in Supabase.
- [x] **Phase 1 Git Checkpoint**
  - [x] Ensure all code is micro-committed with conventional commits.
  - [x] Push to origin, PR opened and merged to `main`. *(PR #1)*

---

## Phase 2: The Agentic Brain (LangGraph & LLMs) ✅
**Branch:** `git checkout -b phase-2-langgraph`
**Goal:** Orchestrate the multi-step reasoning and retrieval agent.

- [x] **2.1 Graph State Definition**
  - [x] Define strict TypeScript `AgentState` in `lib/agent/state.ts` (rawJD, parsedJD, retrievedCandidates, evaluations, currentCandidateIndex).
- [x] **2.2 Node 1: JD Parser (Groq)**
  - [x] Create `lib/agent/nodes/parseJD.ts`.
  - [x] Wire Groq API (`llama-3.3-70b-versatile`) to extract strict JSON (mandatory_skills, optional_skills, max_budget, location, role_summary).
- [x] **2.3 Node 2: Hybrid Retrieval (Supabase RPC)**
  - [x] `match_candidates` RPC defined in `0000_initial_schema.sql` (cosine similarity + threshold).
  - [x] Create `lib/agent/nodes/retrieveMatch.ts` to call this RPC and return top 5 candidates.
- [x] **2.4 Node 3: Simulation Sub-Graph (Groq)**
  - [x] Create `lib/agent/nodes/simulateChat.ts`.
  - [x] Set up Groq API (`llama-3.3-70b-versatile`) for sub-second latency inference.
  - [x] Build the 3-turn simulated conversation loop (Recruiter Agent vs. Candidate Persona).
- [x] **2.5 Node 4: Scoring Matrix**
  - [x] Create `lib/agent/nodes/rankCandidates.ts`.
  - [x] Extract Interest Score (0–100) from the Groq chat transcript.
  - [x] Calculate Final Score = (Match Score × 0.6) + (Interest Score × 0.4).
  - [x] Write results and transcript to the `evaluations` table (non-fatal RLS error handled gracefully).
- [x] **2.6 Graph Compilation**
  - [x] Wire all nodes together in `lib/agent/graph.ts` using `addEdge(START, ...)`.
  - [x] Conditional loop edge: `rankCandidates → simulateChat` if candidates remain, else `END`.
  - [x] Verified end-to-end via `debug-agent.ts` — all 5 candidates scored successfully.
- [x] **Phase 2 Git Checkpoint**
  - [x] Ensure all code is micro-committed.
  - [x] Push to origin, PR opened and merged to `main`. *(PR #2)*

---

## Phase 3: The UI & Explainability (Next.js 16) ✅
**Branch:** `git checkout -b phase-3-frontend`
**Goal:** Build the mission-control dashboard following `DESIGN.md`.

- [x] **3.1 UI Shell & Layout**
  - [x] Configure Tailwind CSS tokens matching `DESIGN.md` (Abyss Black `#050507`, Emerald `#00d992`, etc.) in `app/globals.css`.
  - [x] Build the Left Sidebar (JD textarea input + Agent Telemetry Terminal).
  - [x] Build the Main Canvas (scrollable Results feed with skeleton loaders).
- [x] **3.2 Agent Execution Terminal**
  - [x] Build `components/AgentTerminal.tsx` with `Geist Mono`, 13px, Carbon Surface `#101010`.
  - [x] Live pulsing emerald indicator + node name pill badges.
  - [x] Auto-scroll and blinking cursor animation while agent is running.
- [x] **3.3 The Candidate Card**
  - [x] Build `components/CandidateCard.tsx`.
  - [x] Render Match Score, Interest Score, Final Score as Geist Mono data pills (color-coded).
  - [x] Emerald glow effect (`drop-shadow`) applied to cards with `final_score ≥ 80`.
  - [x] "View AI Reasoning" button opens native slide-over drawer with full Groq chat transcript.
- [x] **3.4 Wiring Frontend to Backend**
  - [x] Create Next.js SSE API route (`app/api/scout/route.ts`) with `maxDuration: 300`.
  - [x] Connect the "Scout Candidates" button to the SSE API route.
  - [x] Frontend reads SSE stream and populates logs + candidate cards in real-time.
- [x] **Phase 3 Git Checkpoint**
  - [x] Ensure all code is micro-committed (`tsc --noEmit` exits clean).
  - [x] Push to origin, PR opened. *(PR #3 — pending merge)*

---

## Phase 4: Hardening, UX Polish & BYOD ✅
**Branch:** `git checkout -b phase-4-hardening-and-polishing`
**Goal:** Enterprise-grade reliability, mobile optimization, and custom data ingestion.

- [x] **4.1 Enterprise Hardening & Security**
  - [x] Resolve all security vulnerabilities (protobufjs, uuid, postcss) via pnpm overrides.
  - [x] Refactor Zustand store to `sessionStorage` for tab-scoped persistence.
  - [x] Clear entire session (including JD) on "Reset Session".
- [x] **4.2 Responsive UX & Mobile View**
  - [x] Implement dedicated `MobileView` accordion-style layout to eliminate overlaps.
  - [x] Add auto-expanding log/candidate tabs based on agent activity.
  - [x] Add "Home" navigation to dashboard for landing page access.
- [x] **4.3 LLM Robustness & BYOD**
  - [x] Implement 30s hard timeouts per horizontal tier to prevent hangs.
  - [x] Add Gemini vertical fallback cascade (Pro → Flash).
  - [x] Implement BYOD (Bring Your Own Data) CSV/JSON ingestion and ranking.
  - [x] Fix session export to include full AI Reasoning transcripts.
- [x] **Phase 4 Git Checkpoint**
  - [x] Ensure all code is micro-committed (`tsc` and `lint` pass).
  - [x] Push to origin, open PR #4 to `main`.

---

## Phase 5: Submission Polish
**Branch:** `git checkout -b phase-5-submission`
**Goal:** Lock in the win.

- [ ] **5.1 Vercel Deployment**
  - [ ] Deploy the Next.js 16 app to Vercel.
  - [ ] Add all production environment variables (Supabase, Groq, SambaNova).
  - [ ] Run a live test on the production URL.
- [ ] **5.2 Repository Polish**
  - [ ] Write the final `README.md` (Architecture diagram, stack explanation, Groq vs SambaNova trade-offs, run-it-locally instructions).
  - [ ] Add `hackathon@deccan.ai` as a repository collaborator.
- [ ] **5.3 Final Git Checkpoint**
  - [ ] Micro-commit documentation updates. 
  - [ ] Push to origin, open PR, merge to `main`.