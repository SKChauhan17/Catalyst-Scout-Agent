import { createClient } from '@supabase/supabase-js';
import { pipeline, env } from '@xenova/transformers';

// 1. Bypass native C++ bindings
env.backends.onnx.wasm.numThreads = 1;

// 2. Fix the missing WASM file error by fetching it dynamically from a CDN
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';

// 3. Fix the Vercel Read-Only Filesystem error by routing the model cache to /tmp
env.cacheDir = '/tmp/.cache';

// 4. Disable local file system models
env.allowLocalModels = false;

import { broadcastAgentLog } from '@/lib/agent/realtime';
import { invokeLLM } from '@/lib/llm/router';
import type { AgentState, Candidate, CustomCandidate, ParsedJD } from '../state';
