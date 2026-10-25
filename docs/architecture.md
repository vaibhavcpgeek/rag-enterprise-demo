# Architecture decisions

## Retrieval

The demo performs semantic vector ranking and lexical keyword ranking separately, then combines rank positions with Reciprocal Rank Fusion (RRF). It reranks the fused candidates before selecting top-K. The demo embedder and reranker are illustrative only; production evaluation must use the real models and corpus.

## Data isolation

The in-memory retriever applies tenant and access-group filtering before returning chunks to the orchestrator. In production, filters must be enforced in the trusted retrieval layer and supported by database/index constraints; source endpoints and caches must repeat the necessary authorisation checks.

## Structured data

The demo exposes a narrow refund metrics tool, not arbitrary SQL execution. In production, use parameterised queries against approved views with a read-only service identity, query limits, and server-derived tenant scope.

## Observability

Each chat response returns a request ID, route trace and stage timings. The demo audit log is in memory and not durable; production needs protected storage, retention policy and redaction.

## Provider adapters

`EmbeddingProvider`, `Reranker` and `LlmProvider` interfaces isolate model choices. Real adapters should enforce model-specific limits, timeouts, retry policies, structured output validation and telemetry.
