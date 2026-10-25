import type { Chunk, UserContext } from "./types.js";
import type { EmbeddingProvider, Reranker } from "./providers.js";
import type { IndexedChunk } from "./ingestion.js";

export function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
  const na = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
  const nb = Math.sqrt(b.reduce((sum, x) => sum + x * x, 0));
  return na && nb ? dot / (na * nb) : 0;
}
function tokens(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
}
function allowed(c: Chunk, u: UserContext): boolean {
  return (
    c.tenantId === u.tenantId &&
    c.accessGroups.some((g) => u.groups.includes(g)) &&
    c.version > 0
  );
}

export async function hybridRetrieve(args: {
  query: string;
  user: UserContext;
  index: IndexedChunk[];
  embedder: EmbeddingProvider;
  reranker: Reranker;
  topK?: number;
}): Promise<Chunk[]> {
  const { query, user, index, embedder, reranker } = args;
  const qv = await embedder.embed(query);
  // Security filter happens before ranking and before chunks are returned to the model.
  const eligible = index.filter((c) => allowed(c, user));
  const vectorRanked = eligible
    .map((c) => ({ ...c, score: cosine(qv, c.embedding) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 30);
  const qTokens = new Set(tokens(query));
  const keywordRanked = eligible
    .map((c) => {
      const words = tokens(c.content);
      const overlap = words.reduce((n, w) => n + (qTokens.has(w) ? 1 : 0), 0);
      const score = overlap / Math.max(1, qTokens.size);
      return { ...c, score };
    })
    .filter((c) => (c.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 30);
  // Reciprocal Rank Fusion combines rank positions instead of incompatible raw scores.
  const scores = new Map<string, { chunk: IndexedChunk; score: number }>();
  const k = 60;
  for (const list of [vectorRanked, keywordRanked])
    list.forEach((c, i) => {
      const old = scores.get(c.id) ?? { chunk: c, score: 0 };
      old.score += 1 / (k + i + 1);
      scores.set(c.id, old);
    });
  const fused = [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((x) => ({ ...x.chunk, score: x.score }));
  const reranked = await reranker.rerank(query, fused);
  return reranked.slice(0, args.topK ?? 6).map((c) => ({
    id: c.id,
    documentId: c.documentId,
    title: c.title,
    content: c.content,
    sourceUrl: c.sourceUrl,
    page: c.page,
    section: c.section,
    department: c.department,
    tenantId: c.tenantId,
    accessGroups: c.accessGroups,
    version: c.version,
    score: c.score,
  }));
}
