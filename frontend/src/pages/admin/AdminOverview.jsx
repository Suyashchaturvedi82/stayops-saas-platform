import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import api from '../../api/axios';

const statsConfig = [
  { key: 'totalRooms', label: 'Rooms' }, { key: 'totalBeds', label: 'Beds' }, { key: 'availableBeds', label: 'Vacant Beds' },
  { key: 'activeResidents', label: 'Active Residents' }, { key: 'pendingPayments', label: 'Pending Payments' }, { key: 'openTickets', label: 'Open Tickets' },
];

export default function AdminOverview() {
  const [stats, setStats] = useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load = async () => { try { const res = await api.get('/admin/dashboard'); setStats(res.data); setError(''); } catch(err) { setError(err.response?.data?.message||'Failed to load operations data.'); } finally { setLoading(false); } };
  useEffect(()=>{load();},[]);
  const money = useMemo(()=>Number(stats?.totalVerifiedRevenue||0).toLocaleString('en-IN'),[stats]);
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mono-label text-xs text-slate-500">COMMAND CENTER</p><h2 className="text-3xl font-bold">Portfolio at a glance</h2><p className="mt-1 text-sm text-slate-500">Occupancy, collections and service health from one screen.</p></div><Button variant="secondary" onClick={load}>{loading?'Refreshing...':'Refresh live data'}</Button></div>
    {loading&&<p className="text-slate-500">Loading live metrics...</p>}{!loading&&error&&<p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!loading&&stats&&<><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{statsConfig.map((item)=><Card key={item.key} className="hover-lift"><p className="mono-label text-[11px] text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{stats[item.key]}</p></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><Card title="Occupancy health" subtitle="Bed-level inventory is the source of truth"><div className="flex items-end justify-between gap-6"><div><p className="text-5xl font-bold">{stats.occupancyRate}%</p><p className="mt-1 text-sm text-slate-500">{stats.occupiedBeds} occupied / {stats.totalBeds} beds</p></div><div className="h-28 w-28 rounded-full border-[12px] border-slate-200" style={{background:`conic-gradient(#111827 ${stats.occupancyRate*3.6}deg, transparent ${stats.occupancyRate*3.6}deg)`}} /></div><div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900 transition-all" style={{width:`${stats.occupancyRate}%`}} /></div><div className="mt-4 flex justify-between text-xs text-slate-500"><span>Vacant: {stats.availableBeds}</span><span>Occupied: {stats.occupiedBeds}</span></div></Card>
      <Card title="Action queue" subtitle="What needs attention now"><div className="space-y-3"><Queue label="Payment verification" value={stats.pendingPayments} tone="warning" /><Queue label="Open maintenance" value={stats.openTickets} tone="info" /><Queue label="High / urgent tickets" value={stats.criticalTickets} tone="danger" /><Queue label="Meals logged today" value={stats.todayMealsCount} tone="success" /></div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Verified revenue</p><p className="mt-1 text-2xl font-bold">₹{money}</p></div></Card></div>
    </>}
  </div>;
}
function Queue({label,value,tone}){return <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span className="text-sm text-slate-700">{label}</span><Badge type={tone}>{value}</Badge></div>}
