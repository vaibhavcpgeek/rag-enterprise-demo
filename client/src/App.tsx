import { useEffect, useState } from 'react';
import { Activity, ArrowDown, BookOpen, Bot, CheckCircle2, ChevronDown, CircleHelp, Clock3, Database, FileText, Gauge, Layers3, LockKeyhole, MessageSquare, RefreshCw, Search, Send, ShieldCheck, Sparkles, Workflow } from 'lucide-react';

type Citation = {sourceId:string;title:string;url:string;page?:number;quote:string};
type ChatResponse = {answer:string;citations:Citation[];requestId:string;insufficientEvidence:boolean;route:string[];timingsMs:Record<string,number>;warnings:string[]};
type Message = {role:'user'|'assistant';text:string;response?:ChatResponse};
const API = 'http://localhost:3001';
const examples = [
  'What is the annual leave carry-over limit?',
  'What was the refund value and refund rate in September 2026?',
  'Explain the refund policy and show the September refund value.',
  'What is the documented process for resetting a forgotten password?',
  'What is the company policy for pet insurance?'
];

export default function App(){
  const [question,setQuestion] = useState('');
  const [messages,setMessages] = useState<Message[]>([{role:'assistant',text:'Welcome to Enterprise RAG Lab. Ask about a policy, a structured metric, or a question that needs both. This starter runs in deterministic demo mode and labels its limitations.'}]);
  const [loading,setLoading] = useState(false);
  const [health,setHealth] = useState<{status:string;mode:string;indexedChunks:number}|null>(null);
  const [showArchitecture,setShowArchitecture] = useState(false);
  const [identity,setIdentity] = useState<'employee'|'finance'>('employee');
  const [error,setError] = useState('');
  useEffect(()=>{fetch(`${API}/api/health`).then(r=>r.json()).then(setHealth).catch(()=>setHealth(null));},[]);
  async function sendQuestion(value=question){
    const q=value.trim(); if(!q||loading)return;
    setQuestion('');setError('');setMessages(m=>[...m,{role:'user',text:q}]);setLoading(true);
    try{
      const response=await fetch(`${API}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json','x-demo-user':identity==='finance'?'demo-finance':'demo-employee','x-demo-groups':identity==='finance'?'employees,finance':'employees','x-demo-roles':identity==='finance'?'employee,analytics_reader':'employee,analytics_reader'},body:JSON.stringify({question:q})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??'Request failed');
      setMessages(m=>[...m,{role:'assistant',text:data.answer,response:data}]);
    }catch(e){setError(e instanceof Error?e.message:'Could not reach the API. Start the server with npm run dev.');}
    finally{setLoading(false);}
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Sparkles size={20}/></div><div><strong>RAG LAB</strong><span>Enterprise reference app</span></div></div>
      <div className="side-label">WORKSPACE</div>
      <button className="side-link active"><MessageSquare size={17}/> Knowledge assistant <span className="live-dot"/></button>
      <button className="side-link" onClick={()=>setShowArchitecture(v=>!v)}><Workflow size={17}/> System architecture <ChevronDown size={15} className={showArchitecture?'rotate':''}/></button>
      <button className="side-link" onClick={()=>sendQuestion('What was the refund value and refund rate in September 2026?')}><Database size={17}/> Structured data demo</button>
      <div className="side-label side-label-spaced">DEMO CONTROLS</div>
      <label className="field-label" htmlFor="identity">Simulated identity</label>
      <select id="identity" value={identity} onChange={e=>setIdentity(e.target.value as 'employee'|'finance')}><option value="employee">Employee (HR + IT)</option><option value="finance">Finance employee</option></select>
      <p className="sidebar-note"><LockKeyhole size={14}/> Demo identity headers are for local testing only, not production authentication.</p>
      <div className="sidebar-bottom"><div className="status-row"><span className={health?'status-dot':'status-dot offline'}/><span>{health?'API connected':'API unavailable'}</span></div><span className="tiny">{health?`${health.indexedChunks} indexed chunks · ${health.mode} mode`:'Run the API server to connect'}</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Knowledge assistant</b></div><div className="top-actions"><span className="demo-badge"><span/> DEMO ENVIRONMENT</span><div className="avatar">R</div></div></header>
      <div className="content-wrap">
        <section className="hero"><div className="eyebrow"><Sparkles size={14}/> RETRIEVAL-AUGMENTED GENERATION</div><h1>Enterprise knowledge,<br/><span>grounded in evidence.</span></h1><p>Explore a hybrid RAG architecture that searches company documents and structured business data, reranks evidence, and returns traceable answers.</p>
          <div className="hero-stats"><div><span className="stat-icon"><Search size={16}/></span><strong>Hybrid search</strong><small>Vector + keyword</small></div><div><span className="stat-icon"><Layers3 size={16}/></span><strong>Reranking</strong><small>Relevance ordering</small></div><div><span className="stat-icon"><ShieldCheck size={16}/></span><strong>Access filters</strong><small>Demo tenant + groups</small></div><div><span className="stat-icon"><Activity size={16}/></span><strong>Observable</strong><small>Per-stage timings</small></div></div>
        </section>
        {showArchitecture&&<section className="architecture-panel"><div className="section-heading"><div><span className="eyebrow">REQUEST LIFECYCLE</span><h2>How this demo works</h2></div><button className="icon-button" onClick={()=>setShowArchitecture(false)}><ChevronDown size={18}/></button></div><div className="architecture-flow">{['React UI','Node API + validation','Hybrid retrieval + RRF','Reranker','Document evidence + safe SQL tool','Grounded response + citations'].map((s,i)=><div className="flow-step" key={s}><span>{String(i+1).padStart(2,'0')}</span>{s}{i<5&&<ArrowDown size={14}/>}</div>)}</div></section>}
        <section className="chat-panel">
          <div className="panel-header"><div className="panel-title-icon"><Bot size={20}/></div><div><h2>Knowledge assistant</h2><p>Ask a question about your company's knowledge</p></div><span className="secure-label"><ShieldCheck size={14}/> Sources attached</span></div>
          <div className="messages">
            {messages.map((m,i)=><div className={`message-row ${m.role}`} key={i}><div className={`message-avatar ${m.role}`}>{m.role==='assistant'?<Bot size={17}/>:<span>Y</span>}</div><div className="message-content"><div className="message-meta">{m.role==='assistant'?'RAG Assistant':'You'} <span>{m.role==='assistant'&&m.response?'· '+m.response.requestId.slice(0,8):''}</span></div><div className={`bubble ${m.response?.insufficientEvidence?'uncertain':''}`}>{m.text}</div>{m.response&&<><div className="answer-tools"><span><Clock3 size={13}/> {m.response.timingsMs.total??0} ms</span><span><Workflow size={13}/> {m.response.route.length?m.response.route.join(' → '):'No retrieval route'}</span></div>{m.response.citations.length>0&&<div className="sources"><div className="sources-title"><BookOpen size={14}/> Retrieved sources <span>{m.response.citations.length}</span></div>{m.response.citations.map(c=><div className="source-card" key={c.sourceId}><div className="source-icon"><FileText size={16}/></div><div className="source-body"><strong>{c.title}</strong><small>{c.sourceId}{c.page?` · Page ${c.page}`:''}</small><p>{c.quote}{c.quote.length>=220?'…':''}</p></div><CheckCircle2 size={15} className="source-check"/></div>)}</div>}{m.response.warnings.map(w=><div className="warning" key={w}><CircleHelp size={14}/>{w}</div>)}</>}</div></div>)}
            {loading&&<div className="message-row assistant"><div className="message-avatar assistant"><Bot size={17}/></div><div className="message-content"><div className="message-meta">RAG Assistant</div><div className="bubble loading-bubble"><span/><span/><span/> Searching, reranking and preparing evidence…</div></div></div>}
            {error&&<div className="error-banner">{error}</div>}
          </div>
          <div className="composer-wrap"><div className="suggestions-label">TRY A QUESTION</div><div className="suggestions">{examples.map(ex=><button key={ex} onClick={()=>sendQuestion(ex)} disabled={loading}>{ex}</button>)}</div><form className="composer" onSubmit={e=>{e.preventDefault();void sendQuestion();}}><Search size={18}/><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about policies, metrics or both…" maxLength={2000}/><button className="send-button" type="submit" disabled={loading||!question.trim()}><Send size={16}/><span>Ask</span></button></form><div className="composer-foot"><span><LockKeyhole size={12}/> Demo data only — don't enter sensitive information</span><span>{question.length}/2000</span></div></div>
        </section>
        <section className="principles"><div className="section-heading"><div><span className="eyebrow">IMPLEMENTED PRINCIPLES</span><h2>Built for real-world RAG concerns</h2></div></div><div className="principle-grid"><Principle icon={<Layers3/>} title="Structure-aware chunking" text="Chunks preserve headings, paragraph context, stable IDs and source metadata."/><Principle icon={<Search/>} title="Hybrid retrieval + RRF" text="Semantic and keyword result lists are fused before candidate reranking."/><Principle icon={<Database/>} title="Mixed data routing" text="Document retrieval and an allowlisted analytics tool handle different question types."/><Principle icon={<ShieldCheck/>} title="Security boundaries" text="Tenant and group filters run before retrieved chunks reach the answer generator."/><Principle icon={<Gauge/>} title="Observability" text="Responses include a request ID, route trace and per-stage timing data."/><Principle icon={<RefreshCw/>} title="Testable design" text="Core chunking, similarity and tenant-isolation tests are included in the project."/></div></section>
        <footer>Enterprise RAG Lab <span>·</span> Reference implementation <span>·</span> Demo mode uses mock embeddings and answer generation</footer>
      </div>
    </main>
  </div>
}
function Principle({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <article className="principle-card"><div className="principle-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>}
