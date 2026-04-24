import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentStateAnnotation, type AgentState } from './state';
import { parseJDNode } from './nodes/parseJD';
import { retrieveMatchNode } from './nodes/retrieveMatch';
import { simulateChatNode } from './nodes/simulateChat';
import { rankCandidatesNode } from './nodes/rankCandidates';

// ============================================================
// Node name constants — avoids magic strings throughout
// ============================================================
const PARSE_JD = 'parseJD' as const;
const RETRIEVE_MATCH = 'retrieveMatch' as const;
const SIMULATE_CHAT = 'simulateChat' as const;
const RANK_CANDIDATES = 'rankCandidates' as const;

// ============================================================
// Conditional edge: loop back or terminate
// ============================================================
function shouldContinueLoop(state: AgentState): typeof SIMULATE_CHAT | typeof END {
  if (state.currentCandidateIndex < state.retrievedCandidates.length) {
    return SIMULATE_CHAT;
  }
  return END;
}

// ============================================================
// Graph compilation
// ============================================================
function buildCatalystScoutGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    // Register all nodes
    .addNode(PARSE_JD, parseJDNode)
    .addNode(RETRIEVE_MATCH, retrieveMatchNode)
    .addNode(SIMULATE_CHAT, simulateChatNode)
    .addNode(RANK_CANDIDATES, rankCandidatesNode)
    // Entry: START → parseJD (replaces deprecated setEntryPoint)
    .addEdge(START, PARSE_JD)
    // Linear pipeline
    .addEdge(PARSE_JD, RETRIEVE_MATCH)
    .addEdge(RETRIEVE_MATCH, SIMULATE_CHAT)
    .addEdge(SIMULATE_CHAT, RANK_CANDIDATES)
    // Conditional loop: after ranking, evaluate whether more candidates remain
    .addConditionalEdges(RANK_CANDIDATES, shouldContinueLoop, {
      [SIMULATE_CHAT]: SIMULATE_CHAT,
      [END]: END,
    });

  return graph.compile();
}

// Singleton compiled graph — re-used across API calls
export const catalystScoutGraph = buildCatalystScoutGraph();
