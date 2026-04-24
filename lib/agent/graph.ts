import { StateGraph, END } from '@langchain/langgraph';
import { AgentStateAnnotation, type AgentState } from './state';
import { parseJDNode } from './nodes/parseJD';
import { retrieveMatchNode } from './nodes/retrieveMatch';
import { simulateChatNode } from './nodes/simulateChat';
import { rankCandidatesNode } from './nodes/rankCandidates';

// ============================================================
// Node name constants — avoids magic strings throughout
// ============================================================
const PARSE_JD = 'parseJD';
const RETRIEVE_MATCH = 'retrieveMatch';
const SIMULATE_CHAT = 'simulateChat';
const RANK_CANDIDATES = 'rankCandidates';

// ============================================================
// Conditional edge: loop or terminate
// ============================================================
function shouldContinueLoop(state: AgentState): 'simulateChat' | typeof END {
  if (state.currentCandidateIndex < state.retrievedCandidates.length) {
    return SIMULATE_CHAT;
  }
  return END;
}

// ============================================================
// Graph compilation
// ============================================================
function buildCatalystScoutGraph() {
  const graph = new StateGraph(AgentStateAnnotation);

  // Register all nodes
  graph.addNode(PARSE_JD, parseJDNode);
  graph.addNode(RETRIEVE_MATCH, retrieveMatchNode);
  graph.addNode(SIMULATE_CHAT, simulateChatNode);
  graph.addNode(RANK_CANDIDATES, rankCandidatesNode);

  // Linear entry path
  graph.setEntryPoint(PARSE_JD);
  graph.addEdge(PARSE_JD, RETRIEVE_MATCH);
  graph.addEdge(RETRIEVE_MATCH, SIMULATE_CHAT);

  // Simulation → Ranking is always sequential
  graph.addEdge(SIMULATE_CHAT, RANK_CANDIDATES);

  // Conditional loop: after ranking, check if more candidates remain
  graph.addConditionalEdges(RANK_CANDIDATES, shouldContinueLoop, {
    [SIMULATE_CHAT]: SIMULATE_CHAT,
    [END]: END,
  });

  return graph.compile();
}

// Singleton compiled graph — re-used across API calls
export const catalystScoutGraph = buildCatalystScoutGraph();
