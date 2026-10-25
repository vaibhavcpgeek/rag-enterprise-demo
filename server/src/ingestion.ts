import { createHash } from "node:crypto";
import type { Chunk } from "./types.js";
import type { EmbeddingProvider } from "./providers.js";

export type SourceDocument = {
  id: string;
  title: string;
  text: string;
  sourceUrl: string;
  department: string;
  tenantId: string;
  accessGroups: string[];
  version: number;
  effectiveDate: string;
};
export type IndexedChunk = Chunk & {
  embedding: number[];
  contentHash: string;
  tokenCount: number;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Structure-aware demo chunker: split at headings/paragraphs, then pack paragraphs up to a token budget.
// Production version should use the chosen model's tokenizer and layout-aware PDF/table parsing.
export function structureAwareChunk(
  doc: SourceDocument,
  targetTokens = 500,
  overlapTokens = 60,
): Omit<IndexedChunk, "embedding">[] {
  const normalised = doc.text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const blocks = normalised
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const output: Omit<IndexedChunk, "embedding">[] = [];
  let buffer: string[] = [];
  let section = "General";
  let count = 0;
  const tokenEstimate = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const flush = () => {
    if (!buffer.length) return;
    const content = buffer.join("\n\n");
    const chunkIndex = output.length;
    output.push({
      id: `${doc.id}-v${doc.version}-chunk-${chunkIndex}`,
      documentId: doc.id,
      title: doc.title,
      content,
      sourceUrl: doc.sourceUrl,
      section,
      department: doc.department,
      tenantId: doc.tenantId,
      accessGroups: doc.accessGroups,
      version: doc.version,
      contentHash: sha256(content),
      tokenCount: tokenEstimate(content),
    });
    const tail: string[] = [];
    let tailCount = 0;
    for (let i = buffer.length - 1; i >= 0 && tailCount < overlapTokens; i--) {
      tail.unshift(buffer[i]);
      tailCount += tokenEstimate(buffer[i]);
    }
    buffer = tail;
    count = tailCount;
  };
  for (const block of blocks) {
    const heading = block.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (count >= targetTokens * 0.5) flush();
      section = heading[1];
    }
    const size = tokenEstimate(block);
    if (count + size > targetTokens && buffer.length) flush();
    // Avoid losing a long paragraph; split it into sentence-sized units when possible.
    if (size > targetTokens) {
      const sentences = block.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const n = tokenEstimate(sentence);
        if (count + n > targetTokens && buffer.length) flush();
        buffer.push(sentence);
        count += n;
      }
    } else {
      buffer.push(block);
      count += size;
    }
  }
  if (buffer.length) {
    // Avoid duplicate final overlap-only chunk.
    const last = buffer.join("\n\n");
    if (!output.length || output[output.length - 1].content !== last) flush();
  }
  return output;
}

export async function embedChunks(
  chunks: Omit<IndexedChunk, "embedding">[],
  embedder: EmbeddingProvider,
): Promise<IndexedChunk[]> {
  // Sequential demo implementation. Production: batch requests with bounded concurrency and retry/backoff.
  const result: IndexedChunk[] = [];
  for (const chunk of chunks)
    result.push({ ...chunk, embedding: await embedder.embed(chunk.content) });
  return result;
}
