import { describe, it, expect } from 'vitest';
import { structureAwareChunk } from './ingestion.js';
import { cosine, hybridRetrieve } from './search.js';
import { DemoEmbeddingProvider, DemoReranker } from './providers.js';
import type { SourceDocument } from './ingestion.js';
import type { UserContext } from './types.js';

const doc: SourceDocument = {id:'HR-042',title:'Annual Leave Policy',sourceUrl:'https://example.invalid/hr',department:'HR',tenantId:'demo',accessGroups:['employees'],version:3,effectiveDate:'2026-10-01',text:'# Carry-over policy\n\nUnused annual leave may be carried forward with manager approval. A maximum of five days may be carried forward.'};
const user: UserContext = {id:'u1',tenantId:'demo',groups:['employees'],roles:['employee']};

describe('RAG demo core',()=>{
  it('chunks documents and preserves source metadata',()=>{
    const chunks = structureAwareChunk(doc,100,10);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].documentId).toBe('HR-042');
    expect(chunks[0].content).toContain('five days');
  });
  it('computes cosine similarity',()=>{
    expect(cosine([1,0,0],[1,0,0])).toBeCloseTo(1);
    expect(cosine([1,0,0],[0,1,0])).toBeCloseTo(0);
  });
  it('retrieves relevant authorised chunks',async()=>{
    const embedder = new DemoEmbeddingProvider();
    const chunks = structureAwareChunk(doc,100,10);
    const index = await Promise.all(chunks.map(async c=>({...c,embedding:await embedder.embed(c.content)})));
    const result = await hybridRetrieve({query:'What is the annual leave carry-over limit?',user,index,embedder,reranker:new DemoReranker()});
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].content).toMatch(/carry|leave/i);
  });
  it('does not return chunks from another tenant',async()=>{
    const embedder = new DemoEmbeddingProvider();
    const chunks = structureAwareChunk(doc,100,10);
    const index = chunks.map((c,i)=>({...c,tenantId:'other-tenant',embedding:[1,0,0]}));
    const result = await hybridRetrieve({query:'annual leave',user,index,embedder,reranker:new DemoReranker()});
    expect(result).toHaveLength(0);
  });
});
