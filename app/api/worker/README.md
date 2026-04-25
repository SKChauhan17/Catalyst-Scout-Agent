# Background Worker Subsystem

<p align="center">
  <img src="https://img.shields.io/badge/Orchestration-Upstash_QStash-141413?style=for-the-badge&labelColor=141413&color=e8e6dc" alt="QStash">
</p>

## Overview
Because AI agent missions can take several minutes (JD parsing + multiple candidate simulations), they cannot run inside a standard Next.js API request without timing out.

The **Worker Subsystem** uses **Upstash QStash** to decouple the request from the execution.

## Execution Flow
1. **Trigger:** The client calls `/api/scout`.
2. **Queue:** `/api/scout` validates the input and publishes a JSON task to QStash.
3. **Webhook:** QStash sends a signed POST request to `/api/worker`.
4. **Execution:** The worker executes the LangGraph mission to completion.

## Security
- **Signature Verification:** All requests to `/api/worker` MUST be signed by Upstash. Unsigned requests are rejected with `401 Unauthorized`.
- **Idempotency:** QStash ensures exactly-once delivery via message IDs, preventing duplicate scouting runs.
- **Admin Privileges:** The worker uses the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for administrative updates to the `jobs` and `evaluations` tables.

## Logs Persistence
During execution, the worker pushes logs to the Supabase `logs` table. This allows the frontend to "reattach" to the live execution even if the user refreshes their browser.
