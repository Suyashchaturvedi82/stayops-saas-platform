import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import useAuth from '../../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await login({ email: email.trim(), password }); navigate(from, { replace: true }); }
    catch (err) { setError(err.response?.data?.message || 'Login failed. Check your workspace and credentials.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#070b18] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl md:grid-cols-2">
        <div className="hidden bg-gradient-to-br from-[#14295f] via-[#1f3b8f] to-[#2f5cff] p-10 text-white md:flex md:flex-col md:justify-between">
          <div><p className="mono-label text-xs text-blue-100">STAYOPS AI</p><h1 className="mt-5 text-5xl font-bold leading-tight">Operate smarter.<br/>Resolve faster.</h1><p className="mt-5 max-w-sm text-sm text-blue-100">A tenant-aware PG operations dashboard with live analytics, maintenance workflows and an AI copilot.</p></div>
          <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-white/10 p-4">Rooms + beds</div><div className="rounded-2xl bg-white/10 p-4">Payments</div><div className="rounded-2xl bg-white/10 p-4">Mess</div><div className="rounded-2xl bg-white/10 p-4">AI assistant</div></div>
        </div>
        <div className="p-6 sm:p-10">
          <p className="mono-label text-xs text-slate-500">SIGN IN</p><h2 className="mt-2 text-3xl font-bold">Welcome back</h2><p className="mt-1 text-sm text-slate-500">Workspace is taken from your saved tenant context.</p>
          {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <form onSubmit={submit} className="mt-6 space-y-4"><Input label="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /><Input label="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /><Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button></form>
          <p className="mt-6 text-sm text-slate-600">New workspace? <Link className="font-semibold text-[#2f5cff]" to="/onboarding">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}
