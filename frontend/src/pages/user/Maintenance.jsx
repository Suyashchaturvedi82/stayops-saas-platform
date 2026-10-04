import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import api from '../../api/axios';

const priorityType = { URGENT: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' };

export default function Maintenance() {
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ title: '', category: 'GENERAL', priority: 'MEDIUM', description: '' });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');

  const load = async () => {
    try { const res = await api.get('/maintenance'); setTickets(res.data || []); }
    catch (err) { setMessage(err.response?.data?.message || 'Could not load tickets.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try { await api.post('/maintenance', form); setForm({ title: '', category: 'GENERAL', priority: 'MEDIUM', description: '' }); setMessage('Ticket raised.'); load(); }
    catch (err) { setMessage(err.response?.data?.message || 'Ticket creation failed.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mono-label text-xs text-slate-500">SERVICE DESK</p><h2 className="text-3xl font-bold">Maintenance & Complaints</h2></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">{tickets.filter((t)=>['OPEN','IN_PROGRESS'].includes(t.status)).length} open</span></div>
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card title="Raise an issue" subtitle="Describe the problem once; track every update"><form onSubmit={submit} className="space-y-4"><Input label="Issue title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required /><div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label><select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5"><option>GENERAL</option><option>PLUMBING</option><option>ELECTRICAL</option><option>CLEANING</option><option>INTERNET</option><option>FOOD</option><option>SECURITY</option></select></div><div><label className="mb-1.5 block text-sm font-medium text-slate-700">Priority</label><select value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-2.5"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></div></div><div><label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label><textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="min-h-28 w-full rounded-xl border border-slate-200 px-4 py-3" required /></div><Button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Create Ticket'}</Button></form>{message && <p className="mt-3 text-sm text-slate-600">{message}</p>}</Card>
      <Card title="Ticket timeline" subtitle="Live status from your workspace"><div className="space-y-3">{loading && <p className="text-slate-500">Loading...</p>}{!loading && tickets.length===0 && <p className="text-slate-500">No tickets yet.</p>}{tickets.map((ticket)=><div key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:-translate-y-0.5 hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-900">{ticket.title}</p><p className="text-xs text-slate-500">{ticket.category} · #{ticket.id}</p></div><div className="flex gap-2"><Badge type={priorityType[ticket.priority] || 'neutral'}>{ticket.priority}</Badge><Badge type={ticket.status==='RESOLVED' || ticket.status==='CLOSED' ? 'success' : 'warning'}>{ticket.status}</Badge></div></div><p className="mt-3 text-sm text-slate-600">{ticket.description}</p>{ticket.resolution_note && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">Resolution: {ticket.resolution_note}</p>}</div>)}</div></Card></div></div>;
}
