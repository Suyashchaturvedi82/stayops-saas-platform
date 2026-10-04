import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';

const prompts = ['How many beds are vacant?', 'What is our occupancy?', 'What payments are pending?', 'How many maintenance tickets are open?'];

export default function AICopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState('local');
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi — I’m your StayOps copilot. Ask about occupancy, dues, revenue, mess or maintenance.' }]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);
  useEffect(() => { api.get('/ai/status').then((res) => setProvider(res.data?.provider || 'local')).catch(() => {}); }, []);

  const ask = async (text) => {
    const value = (text || input).trim(); if (!value || sending) return;
    setMessages((prev) => [...prev, { role: 'user', content: value }]); setInput(''); setSending(true);
    try {
      const res = await api.post('/ai/chat', { message: value, history: messages });
      setProvider(res.data?.provider || provider);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data?.answer || 'No answer returned.' }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: err.response?.data?.message || 'The assistant is temporarily unavailable.' }]);
    } finally { setSending(false); }
  };

  return <><button onClick={()=>setOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/10 transition hover:-translate-y-1" aria-label="Open AI assistant"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">✦</span>StayOps AI</button>
    {open && <div className="fixed inset-0 z-50 bg-slate-950/25 backdrop-blur-[2px]" onClick={()=>setOpen(false)}><div className="absolute bottom-0 right-0 h-[min(680px,88vh)] w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:bottom-5 sm:right-5 sm:h-[680px] sm:w-[430px] sm:rounded-3xl" onClick={(e)=>e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-4 py-4 text-white"><div><p className="text-sm font-semibold">StayOps AI Copilot</p><p className="text-[11px] text-slate-400">{provider==='gemini' ? 'Gemini connected' : 'Fast workspace tools'}</p></div><button onClick={()=>setOpen(false)} className="rounded-lg px-2 py-1 text-slate-300 hover:bg-white/10">✕</button></div>
      <div className="flex h-[calc(100%-128px)] flex-col"><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((m,i)=><div key={i} className={m.role==='user'?'ml-8 rounded-2xl rounded-br-sm bg-slate-950 p-3 text-sm text-white':'mr-6 rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700'}>{m.content}</div>)}{sending&&<div className="mr-20 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">Thinking…</div>}<div ref={endRef}/></div><div className="border-t border-slate-200 p-3"><div className="mb-2 flex gap-2 overflow-x-auto">{prompts.map((p)=><button key={p} onClick={()=>ask(p)} className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-100">{p}</button>)}</div><form onSubmit={(e)=>{e.preventDefault();ask();}} className="flex gap-2"><input value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Ask about your PG…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"/><button disabled={sending} className="rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Send</button></form></div></div>
    </div></div>}
  </>;
}
