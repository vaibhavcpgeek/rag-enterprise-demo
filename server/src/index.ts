import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { demoDocuments } from './demoData.js';
import { structureAwareChunk, embedChunks } from './ingestion.js';
import { DemoEmbeddingProvider, DemoLlmProvider, DemoReranker } from './providers.js';
import { hybridRetrieve } from './search.js';
import { queryRefundMetrics } from './sqlTool.js';
import type { ChatResponse, UserContext, Chunk } from './types.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const origin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin,credentials:true}));
app.use(express.json({limit:'1mb'}));

const embedder = new DemoEmbeddingProvider();
const reranker = new DemoReranker();
const llm = new DemoLlmProvider();
let index: Awaited<ReturnType<typeof embedChunks>> = [];
const startedAt = Date.now();
const audit: Array<{requestId:string;userId:string;event:string;at:string;details?:unknown}> = [];

async function initialise() {
  for (const doc of demoDocuments) {
    const chunks = structureAwareChunk(doc, 500, 60);
    index.push(...await embedChunks(chunks, embedder));
  }
}
function getUser(req: express.Request): UserContext {
  // DEMO ONLY: header-based identity is insecure and must never be used in production.
  // Replace with validated OIDC/JWT middleware and server-derived group/role claims.
  const allowDemo = process.env.ALLOW_DEMO_IDENTITY !== 'false';
  if (!allowDemo) throw new Error('Configure production identity middleware before disabling demo identity.');
  const userId = String(req.header('x-demo-user') ?? 'demo-employee');
  const groupHeader = String(req.header('x-demo-groups') ?? 'employees');
  const roleHeader = String(req.header('x-demo-roles') ?? 'employee,analytics_reader');
  return {id:userId,tenantId:'demo',groups:groupHeader.split(',').map(s=>s.trim()).filter(Boolean),roles:roleHeader.split(',').map(s=>s.trim()).filter(Boolean)};
}
function auditEvent(requestId:string,userId:string,event:string,details?:unknown) {
  audit.push({requestId,userId,event,at:new Date().toISOString(),details});
  if (audit.length > 500) audit.shift();
}

app.get('/api/health', (_req,res) => res.json({status:'ok',mode:'demo',uptimeMs:Date.now()-startedAt,indexedChunks:index.length}));
app.get('/api/demo/documents', (req,res) => {
  const user = getUser(req);
  const visible = demoDocuments.filter(d=>d.tenantId===user.tenantId && d.accessGroups.some(g=>user.groups.includes(g)));
  res.json(visible.map(d=>({id:d.id,title:d.title,department:d.department,version:d.version,effectiveDate:d.effectiveDate})));
});

const chatSchema = z.object({question:z.string().trim().min(2).max(2000)});
app.post('/api/chat', async (req,res) => {
  const requestId = randomUUID();
  const t0 = performance.now();
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:'Question must be between 2 and 2000 characters.',requestId});
    const user = getUser(req);
    auditEvent(requestId,user.id,'chat.requested');
    const question = parsed.data.question;
    const timingsMs: Record<string,number> = {};
    const route: string[] = [];
    const warnings: string[] = [];
    const tRetrieve = performance.now();
    const [chunks, sqlResult] = await Promise.all([
      hybridRetrieve({query:question,user,index,embedder,reranker,topK:6}),
      queryRefundMetrics(question,user)
    ]);
    timingsMs.retrievalAndSql = Math.round(performance.now()-tRetrieve);
    if (chunks.length) route.push('document-hybrid-search','rrf-fusion','reranking');
    if (sqlResult) route.push('authorised-sql-tool');
    const tGen = performance.now();
    const answer = await llm.answer(question,chunks,sqlResult);
    timingsMs.generation = Math.round(performance.now()-tGen);
    const citations = chunks.map(c=>({sourceId:c.id,title:c.title,url:c.sourceUrl,page:c.page,quote:c.content.slice(0,220)}));
    // In a real provider implementation, validate every model-proposed source ID against this set.
    const insufficientEvidence = !chunks.length && !sqlResult;
    if (insufficientEvidence) warnings.push('No authorised evidence matched this question.');
    const response: ChatResponse = {answer,citations,requestId,insufficientEvidence,route,timingsMs,warnings};
    auditEvent(requestId,user.id,'chat.completed',{route,citationCount:citations.length,insufficientEvidence});
    timingsMs.total = Math.round(performance.now()-t0);
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    const status = /not authorised/i.test(message) ? 403 : 500;
    res.status(status).json({error:status===403?message:'The request could not be completed.',requestId});
  }
});

app.post('/api/demo/reindex', async (req,res) => {
  const user = getUser(req);
  if (!user.roles.includes('admin')) return res.status(403).json({error:'Admin role required.'});
  const next = [] as typeof index;
  for (const doc of demoDocuments) next.push(...await embedChunks(structureAwareChunk(doc),embedder));
  index = next; auditEvent(randomUUID(),user.id,'demo.reindex.completed',{chunkCount:index.length});
  res.json({status:'succeeded',chunks:index.length});
});
app.get('/api/demo/audit', (req,res) => {
  const user = getUser(req);
  if (!user.roles.includes('admin')) return res.status(403).json({error:'Admin role required.'});
  res.json(audit);
});

await initialise();
app.listen(port,()=>console.log(`RAG demo API listening on http://localhost:${port} (${index.length} chunks indexed)`));
