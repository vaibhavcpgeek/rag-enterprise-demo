# Enterprise RAG Lab — runnable reference app

A React + TypeScript frontend and Node.js/TypeScript API demonstrating a mixed-data RAG design: structure-aware chunking, embeddings, hybrid vector + keyword retrieval, Reciprocal Rank Fusion (RRF), reranking, an allowlisted structured-data tool, citations, tenant/group filtering, audit events, timings and tests.

## Important scope note

This is a **local educational reference implementation**, not a production-secure enterprise deployment. It runs in deterministic demo mode without API keys. The demo uses tiny illustrative embeddings, a lexical reranker, a template-based answer generator, in-memory document indexing and a mock structured-data adapter. The SQL schema and Docker Compose service show how PostgreSQL/pgvector can be introduced, but the demo API does not persist or query the live PostgreSQL service yet.

Before production, replace demo identity headers with validated OIDC/JWT middleware, connect real document sources, use a real embedding provider and LLM, implement database-backed retrieval with the chosen model's vector dimension, run a real SQL query through a read-only role, add a durable queue, and complete security/performance testing.

## Requirements

- Node.js 20+
- npm 10+
- Optional: Docker for the PostgreSQL/pgvector schema sandbox

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. The API starts at http://localhost:3001.

No model credentials are required in demo mode. If the UI says the API is unavailable, check the terminal running `npm run dev`.

## Run tests and build

```bash
npm test
npm run build
```

## Optional PostgreSQL/pgvector sandbox

```bash
docker compose up -d postgres
```

The schema is mounted into the container's initialisation directory. For an existing volume, apply the schema manually with `psql` or recreate the volume if you want the init script to run again. Demo retrieval remains in memory until you implement the PostgreSQL repository adapter.

## Demo questions

- `What is the annual leave carry-over limit?`
- `What was the refund value and refund rate in September 2026?`
- `Explain the refund policy and show the September refund value.`
- `What is the documented process for resetting a forgotten password?`
- `What is the company policy for pet insurance?`

Switch the simulated identity to Finance to see the Finance-only policy become retrievable. This is a demonstration of a backend group filter, not a real identity system.

## What is implemented

- React chat UI with suggested questions and source cards
- Express API with input validation, CORS and Helmet security headers
- Structure-aware chunking with overlap, stable IDs, source metadata and content hashes
- Embedding provider interface and deterministic demo embedder
- Vector similarity ranking and lexical keyword retrieval
- Reciprocal Rank Fusion (RRF)
- Reranker interface and demo reranker
- Tenant and access-group filters applied before returning retrieval results
- Mixed-data query routing through a constrained refund-metrics tool
- Grounded demo answer generation and citations derived from retrieved chunks
- Request IDs, route traces, per-stage timings and in-memory audit events
- Admin-only demo reindex/audit endpoints
- PostgreSQL/pgvector schema for documents, chunks, ingestion jobs, audit events and structured metrics
- Tests for chunk metadata, cosine similarity, relevant retrieval and tenant isolation

## Architecture modules

- `server/src/ingestion.ts` — chunking, content hashing and embedding orchestration
- `server/src/search.ts` — permission filtering, vector ranking, keyword ranking, RRF and reranking
- `server/src/providers.ts` — embedding, reranker and LLM provider contracts with demo implementations
- `server/src/sqlTool.ts` — allowlisted structured-data tool; no arbitrary generated SQL execution
- `server/src/index.ts` — API routes, request validation, orchestration, audit and timings
- `server/sql/schema.sql` — PostgreSQL/pgvector reference schema
- `client/src/App.tsx` — frontend chat UI and architecture overview

## Production hardening checklist

1. Replace demo headers with verified identity tokens; derive tenant, roles and groups only from trusted claims.
2. Persist chunks and vectors in PostgreSQL/pgvector or a managed hybrid search platform. Set vector dimensions to match the chosen embedding model.
3. Implement real embedding and LLM adapters, with timeouts, retry/backoff, bounded concurrency and secret management.
4. Add document connectors, OCR/layout-aware parsing, table-aware chunking, durable queue workers and idempotent ingestion jobs.
5. Implement true version publication, stale-version retirement, deletion/revocation handling and cache invalidation.
6. Execute approved SQL using parameterised queries, a read-only database role, approved views, query limits and row-level/tenant permissions.
7. Validate citations and claim support. Do not assume that a model-produced citation is correct.
8. Add rate limiting, request cancellation, durable audit storage, redaction, distributed tracing and alerting.
9. Build a labelled evaluation dataset. Track Recall@K, MRR/nDCG, correctness, faithfulness, citation support, abstention, p95 latency and cost.
10. Perform threat modelling, prompt-injection testing, cross-tenant tests, load tests and data-retention review before production.

## Demo identity warning

The frontend sends `x-demo-user`, `x-demo-groups` and `x-demo-roles` headers. They are user-editable and **must not be trusted in production**. The API intentionally labels this as demo-only. Real deployments must validate tokens and construct the user context in trusted middleware.
