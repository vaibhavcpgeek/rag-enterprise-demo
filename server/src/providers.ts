import type { Chunk } from "./types.js";

// Demo vectors are deterministic and intentionally tiny. Replace with real model embeddings in production.
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}
export interface Reranker {
  rerank(query: string, chunks: Chunk[]): Promise<Chunk[]>;
}
export interface LlmProvider {
  answer(
    question: string,
    context: Chunk[],
    sqlResult?: SqlResult,
  ): Promise<string>;
}
export type SqlResult = {
  month: string;
  refundsCount: number;
  ordersCount: number;
  refundValue: number;
  refundRate: number;
};

export class DemoEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const s = text.toLowerCase();
    const terms = [
      ["holiday", "leave", "carry-over", "carry over", "annual"],
      ["refund", "order", "sales", "transaction", "value"],
      ["password", "login", "access", "reset"],
    ];
    const vec = terms.map(
      (group) =>
        group.reduce((n, word) => n + (s.includes(word) ? 1 : 0), 0) + 0.01,
    );
    const norm = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0));
    return vec.map((n) => n / norm);
  }
}

export class DemoReranker implements Reranker {
  async rerank(query: string, chunks: Chunk[]): Promise<Chunk[]> {
    const q = new Set(query.toLowerCase().match(/[a-z0-9-]+/g) ?? []);
    return chunks
      .map((c) => {
        const words = c.content.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
        const overlap = words.reduce((n, w) => n + (q.has(w) ? 1 : 0), 0);
        return {
          ...c,
          score: overlap / Math.max(1, q.size) + (c.score ?? 0) * 0.1,
        };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
}

export class DemoLlmProvider implements LlmProvider {
  async answer(
    question: string,
    context: Chunk[],
    sqlResult?: SqlResult,
  ): Promise<string> {
    const q = question.toLowerCase();
    const evidence = context.map((c) => c.content).join("\n");
    if (!context.length && !sqlResult)
      return "I couldn't find sufficient evidence in the available sources to answer that reliably.";
    const parts: string[] = [];
    if (context.length) {
      if (q.includes("carry") || q.includes("holiday") || q.includes("leave")) {
        const policy =
          context.find((c) => /carry|leave|holiday/i.test(c.content)) ??
          context[0];
        parts.push(`According to ${policy.title}, ${policy.content}`);
      } else {
        parts.push(`Based on the retrieved documentation: ${evidence}`);
      }
    }
    if (sqlResult) {
      parts.push(
        `For ${sqlResult.month}, the demo data records ${sqlResult.refundsCount} refunds with a total value of £${sqlResult.refundValue.toFixed(2)}. The refund rate is ${(sqlResult.refundRate * 100).toFixed(2)}% (${sqlResult.refundsCount} refunds divided by ${sqlResult.ordersCount} orders).`,
      );
    }
    return parts.join("\n\n");
  }
}
