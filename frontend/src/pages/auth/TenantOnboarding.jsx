import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import useAuth from '../../hooks/useAuth';

const initial = { tenant_name: '', tenant_slug: '', owner_name: '', email: '', phone: '', gender: 'OTHER', password: '', confirmPassword: '' };

export default function TenantOnboarding() {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { onboard } = useAuth();
  const navigate = useNavigate();

  const change = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await onboard(form);
      navigate('/admin/overview', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Workspace creation failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#070b18] p-4 text-white sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-blue-600/30 via-indigo-500/10 to-emerald-400/10 p-10 lg:flex">
          <div>
            <p className="mono-label text-xs text-blue-200">STAYOPS AI</p>
            <h1 className="mt-5 text-5xl font-bold leading-tight">Your PG.<br/>One intelligent workspace.</h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">Room inventory, bookings, rent, mess, maintenance and an AI operations copilot built on the same tenant-aware system.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><b className="block text-white">AI Copilot</b>Live operational answers</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><b className="block text-white">Multi-tenant</b>Scoped data access</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><b className="block text-white">Maintenance</b>SLA-ready tickets</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><b className="block text-white">Automation</b>Queues + reminders</div>
          </div>
        </div>

        <div className="bg-white p-6 text-slate-900 sm:p-10">
          <p className="mono-label text-xs text-slate-500">CREATE WORKSPACE</p>
          <h2 className="mt-2 text-3xl font-bold">Launch your PG operating system</h2>
          <p className="mt-1 text-sm text-slate-500">One step creates the workspace and its owner account.</p>
          {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input label="PG / Workspace Name" name="tenant_name" value={form.tenant_name} onChange={change} required />
            <Input label="Workspace Slug" name="tenant_slug" value={form.tenant_slug} onChange={change} placeholder="sunrise-pg" />
            <Input label="Owner Name" name="owner_name" value={form.owner_name} onChange={change} required />
            <Input label="Email" type="email" name="email" value={form.email} onChange={change} required />
            <Input label="Phone" name="phone" value={form.phone} onChange={change} required />
            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Gender</label><select name="gender" value={form.gender} onChange={change} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5" required><option>OTHER</option><option>MALE</option><option>FEMALE</option></select></div>
            <Input label="Password" type="password" name="password" value={form.password} onChange={change} minLength={8} required />
            <Input label="Confirm Password" type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} minLength={8} required />
            <Button type="submit" className="sm:col-span-2" disabled={loading}>{loading ? 'Creating workspace...' : 'Create Workspace & Enter Dashboard'}</Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">Already set up? <a href="/login" className="font-semibold text-[#2f5cff]">Sign in</a></p>
        </div>
      </div>
    </div>
  );
}
