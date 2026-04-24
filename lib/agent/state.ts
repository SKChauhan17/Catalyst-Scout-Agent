import { Annotation } from '@langchain/langgraph';

// ============================================================
// Candidate shape returned from the match_candidates RPC
// ============================================================
export interface Candidate {
  id: string;
  name: string;
  skills: string[];
  location: string;
  salary_expectation: string;
  system_prompt_persona: string;
  similarity: number;
}

// ============================================================
// Parsed structure extracted from the raw Job Description
// ============================================================
export interface ParsedJD {
  mandatory_skills: string[];
  optional_skills: string[];
  location: string;
  max_budget: string;
  role_summary: string;
}

// ============================================================
// A single turn in the simulated recruiter/candidate chat
// ============================================================
export interface ChatTurn {
  role: 'recruiter' | 'candidate';
  content: string;
}

// ============================================================
// The evaluation record built per candidate during the loop
// ============================================================
export interface CandidateEvaluation {
  candidate_id: string;
  match_score: number;        // Cosine similarity score from pgvector (0–1)
  interest_score: number;     // LLM-extracted interest score (0–100)
  final_score: number;        // (match_score * 0.6) + (interest_score * 0.4)
  chat_transcript: ChatTurn[];
}

// ============================================================
// Master LangGraph Agent State — the single source of truth
// for the entire agentic workflow.
// ============================================================
export const AgentStateAnnotation = Annotation.Root({
  // Raw job description text submitted by the user
  rawJD: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // Structured JD extracted by the JD Parser node
  parsedJD: Annotation<ParsedJD | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Top candidates returned from the hybrid Supabase RPC
  retrievedCandidates: Annotation<Candidate[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Accumulated evaluation records, one per candidate
  evaluations: Annotation<CandidateEvaluation[]>({
    reducer: (existing, next) => [...existing, ...next],
    default: () => [],
  }),

  // Pointer tracking which candidate is being processed in the loop
  currentCandidateIndex: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
});

// Convenience type alias for use across all node files
export type AgentState = typeof AgentStateAnnotation.State;
