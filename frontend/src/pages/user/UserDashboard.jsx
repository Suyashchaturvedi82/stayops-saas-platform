import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import api from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function UserDashboard() {
  const { user } = useAuth(); const [bookings,setBookings]=useState([]); const [tickets,setTickets]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load=async()=>{try{const [b,t]=await Promise.all([api.get('/bookings/my'),api.get('/maintenance')]);setBookings(b.data||[]);setTickets(t.data||[]);setError('')}catch(err){setError(err.response?.data?.message||'Failed to load dashboard.')}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const activeTickets=useMemo(()=>tickets.filter(t=>['OPEN','IN_PROGRESS'].includes(t.status)).length,[tickets]);
  const latest=bookings[0];
  return <div className="space-y-5"><section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8"><div className="flex flex-wrap items-end justify-between gap-6"><div><p className="mono-label text-xs text-slate-400">RESIDENT HOME</p><h1 className="mt-2 text-3xl font-bold">Good to see you, {user?.first_name||'Resident'}.</h1><p className="mt-2 max-w-xl text-sm text-slate-400">Your room, payments, mess and maintenance activity live here. The AI copilot is always one click away.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-right"><p className="text-xs text-slate-400">Workspace</p><p className="font-semibold">{localStorage.getItem('tenant_slug')||'Tenant'}</p></div></div></section>
    {loading&&<p className="text-slate-500">Loading your workspace...</p>}{!loading&&error&&<p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{!loading&&!error&&<div className="grid gap-5 lg:grid-cols-3"><Card title="Current stay" subtitle="Latest booking"><div className="space-y-3"><Stat label="Room" value={latest?.room_number||'Not assigned'} /><Stat label="Bed" value={latest?.bed_number||'—'} /><Stat label="Status" value={latest?<Badge type={latest.booking_status==='APPROVED'?'success':'warning'}>{latest.booking_status}</Badge>:'—'} /></div><Link to="/bookings" className="mt-5 inline-flex"><Button variant="secondary">Open bookings</Button></Link></Card><Card title="Maintenance" subtitle="Service health"><p className="text-4xl font-bold">{activeTickets}</p><p className="mt-1 text-sm text-slate-500">open requests</p><Link to="/maintenance" className="mt-5 inline-flex"><Button>Report an issue</Button></Link></Card><Card title="Assistant" subtitle="Ask for live workspace info"><p className="text-sm leading-6 text-slate-600">Try asking “How many beds are vacant?” or “What payments are pending?” and get a tenant-scoped answer.</p><div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">Use the <b>StayOps AI</b> button in the bottom-right corner.</div></Card></div>}</div>;
}
function Stat({label,value}){return <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-900">{value}</span></div>}
