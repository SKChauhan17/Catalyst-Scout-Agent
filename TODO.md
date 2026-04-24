# Catalyst Scout - Master Execution Ledger
**Deadline:** Monday, April 27, 1:00 AM IST 
**Objective:** Zero-compromise AI-Powered Talent Scouting Agent

> **AI Agent Directive:** You must check off these boxes `[x]` as you complete them. You are strictly forbidden from moving to a new phase until the current phase is fully checked off, micro-committed, pushed, merged into `main`, and a new branch is checked out. 
> 
> *STRICT RULE:* Use `pnpm` exclusively. Never use `npm` or `yarn`.

---

## Phase 1: Foundation & The Data Engine
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
  - [x] Integrate OpenRouter free tier (e.g., Llama 3 70B) to generate realistic `system_prompt_persona` for each candidate.
  - [x] Integrate Transformers.js (or OpenRouter embedding model) to generate 384-dimensional vectors for each candidate.
  - [ ] Execute seed script and verify 100 records in Supabase.
- [x] **Phase 1 Git Checkpoint**
  - [x] Ensure all code is micro-committed with conventional commits (e.g., `feat: database schema and rls`).
  - [x] Push to origin, open PR, instruct user to merge to `main`.

---

## Phase 2: The Agentic Brain (LangGraph & LLMs)
**Branch:** `git checkout -b phase-2-langgraph`
**Goal:** Orchestrate the multi-step reasoning and retrieval agent.

- [ ] **2.1 Graph State Definition**
  - [ ] Define strict TypeScript `AgentState` in `lib/agent/state.ts` (rawJD, parsedJD, retrievedCandidates, evaluations).
- [ ] **2.2 Node 1: JD Parser (OpenRouter)**
  - [ ] Create `lib/agent/nodes/parseJD.ts`.
  - [ ] Wire OpenRouter API to extract strict JSON (mandatory_skills, optional_skills, max_budget, location_type).
- [ ] **2.3 Node 2: Hybrid Retrieval (Supabase RPC)**
  - [ ] Write Supabase RPC SQL function for hybrid search (strict SQL filters + pgvector cosine distance).
  - [ ] Create `lib/agent/nodes/retrieveMatch.ts` to call this RPC and return the top 10 candidates.
- [ ] **2.4 Node 3: Simulation Sub-Graph (Groq)**
  - [ ] Create `lib/agent/nodes/simulateChat.ts`.
  - [ ] Set up Groq API for sub-second latency inference.
  - [ ] Build the 3-turn simulated conversation loop (Recruiter Agent vs. Candidate Persona).
- [ ] **2.5 Node 4: Scoring Matrix**
  - [ ] Create `lib/agent/nodes/rankCandidates.ts`.
  - [ ] Extract Interest Score (0-100) from the Groq chat transcript.
  - [ ] Calculate Final Score = (Match Score * 0.6) + (Interest Score * 0.4).
  - [ ] Write results and transcript to the `evaluations` table.
- [ ] **2.6 Graph Compilation**
  - [ ] Wire all nodes together in `lib/agent/graph.ts`.
  - [ ] Test the graph execution end-to-end via a local test script.
- [ ] **Phase 2 Git Checkpoint**
  - [ ] Ensure all code is micro-committed.
  - [ ] Push to origin, open PR, instruct user to merge to `main`.

---

## Phase 3: The UI & Explainability (Next.js 16)
**Branch:** `git checkout -b phase-3-frontend`
**Goal:** Build the mission-control dashboard following `design.md`.

- [ ] **3.1 UI Shell & Layout**
  - [ ] Configure Tailwind CSS tokens matching `design.md` (Abyss Black `#050507`, Emerald `#00d992`, etc.).
  - [ ] Build the Left Sidebar (JD input + terminal logs).
  - [ ] Build the Main Canvas (Results feed).
- [ ] **3.2 Agent Execution Terminal**
  - [ ] Build a streaming text UI component using `Geist Mono`.
  - [ ] Wire it to display active LangGraph nodes (e.g., `[✓] Extracted JD schema`).
- [ ] **3.3 The Candidate Card**
  - [ ] Build `CandidateCard.tsx` component.
  - [ ] Render Match Score and Interest Score as monospace data pills.
  - [ ] Build the "AI Explainability" slide-over drawer to display the Groq chat transcript.
- [ ] **3.4 Wiring Frontend to Backend**
  - [ ] Create Next.js API route (`app/api/agent/route.ts`) to trigger the LangGraph workflow.
  - [ ] Connect the "Scout" button to the API route.
- [ ] **Phase 3 Git Checkpoint**
  - [ ] Ensure all code is micro-committed (e.g., `ui: candidate card and explainability drawer`).
  - [ ] Push to origin, open PR, instruct user to merge to `main`.

---

## Phase 4: Hardening & Fallbacks
**Branch:** `git checkout -b phase-4-hardening`
**Goal:** Ensure the prototype doesn't crash during the judge's demo.

- [ ] **4.1 Timeout Mitigation**
  - [ ] Implement Upstash QStash (or background API route pattern) to handle long-running LangGraph executions without hitting Vercel's 10-second serverless timeout.
  - [ ] Update frontend to poll Supabase `evaluations` table for final results.
- [ ] **4.2 Edge-Case Handling**
  - [ ] Add `try/catch` fallbacks to OpenRouter JSON parsing.
  - [ ] Add gracefully handled loading states (skeletons) in the UI.
- [ ] **Phase 4 Git Checkpoint**
  - [ ] Ensure all code is micro-committed.
  - [ ] Push to origin, open PR, instruct user to merge to `main`.

---

## Phase 5: Submission Polish
**Branch:** `git checkout -b phase-5-submission`
**Goal:** Lock in the win.

- [ ] **5.1 Vercel Deployment**
  - [ ] Deploy the Next.js 16 app to Vercel.
  - [ ] Add all production environment variables (Supabase, Groq, OpenRouter).
  - [ ] Run a live test on the production URL.
- [ ] **5.2 Repository Polish**
  - [ ] Write the final `README.md` (Architecture diagram, stack explanation, Groq vs OpenRouter trade-offs, run-it-locally instructions).
  - [ ] Add `hackathon@deccan.ai` as a repository collaborator.
- [ ] **5.3 Final Git Checkpoint**
  - [ ] Micro-commit documentation updates. 
  - [ ] Push to origin, open PR, merge to `main`.