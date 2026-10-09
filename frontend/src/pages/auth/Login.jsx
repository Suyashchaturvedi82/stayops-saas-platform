import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import useAuth from '../../hooks/useAuth';
import { isOperator } from '../../utils/authRoles';

/**
 * Distinct login pages backed by distinct backend handlers:
 *   audience="tenant" -> POST /auth/tenant/login  -> /dashboard (resident)
 *   audience="owner"  -> POST /auth/owner/login   -> /admin/overview (operator)
 */
export default function Login({ audience = 'tenant' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [choices, setChoices] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isOwner = audience === 'owner';
  const from = location.state?.from?.pathname;

  const submitWith = async (slug) => {
    setError('');
    setChoices(null);
    setLoading(true);
    try {
      const user = await login({
        audience,
        email: email.trim(),
        password,
        ...(slug ? { tenant_slug: slug } : {}),
      });
      navigate(from || (isOperator(user) ? '/admin/overview' : '/dashboard'), { replace: true });
    } catch (err) {
      const data = err.response?.data;
      // 409 = identity holds memberships in several workspaces for this audience.
      if (err.response?.status === 409 && data?.details?.workspaces?.length) {
        setChoices(data.details.workspaces);
        setError('Choose the workspace you want to sign in to.');
      } else {
        setError(data?.message || 'Login failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    submitWith(workspaceSlug.trim() || undefined);
  };

  return (
    <div className="min-h-screen bg-[#070b18] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl md:grid-cols-2">
        <div className="hidden bg-gradient-to-br from-[#14295f] via-[#1f3b8f] to-[#2f5cff] p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <p className="mono-label text-xs text-blue-100">STAYOPS AI</p>
            <h1 className="mt-5 text-5xl font-bold leading-tight">
              {isOwner ? (<>Operate smarter.<br />Resolve faster.</>) : (<>Find your stay.<br />Move in faster.</>)}
            </h1>
            <p className="mt-5 max-w-sm text-sm text-blue-100">
              {isOwner
                ? 'A tenant-aware PG operations dashboard with live analytics, maintenance workflows and an AI copilot.'
                : 'Browse PGs, book a bed, track payments and raise maintenance requests — all in one place.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {isOwner ? (
              <>
                <div className="rounded-2xl bg-white/10 p-4">Rooms + beds</div>
                <div className="rounded-2xl bg-white/10 p-4">Payments</div>
                <div className="rounded-2xl bg-white/10 p-4">Mess</div>
                <div className="rounded-2xl bg-white/10 p-4">AI assistant</div>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-white/10 p-4">Browse PGs</div>
                <div className="rounded-2xl bg-white/10 p-4">Book a bed</div>
                <div className="rounded-2xl bg-white/10 p-4">Payments</div>
                <div className="rounded-2xl bg-white/10 p-4">Maintenance</div>
              </>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <p className="mono-label text-xs text-slate-500">
            {isOwner ? 'PG OWNER SIGN IN' : 'RESIDENT SIGN IN'}
          </p>
          <h2 className="mt-2 text-3xl font-bold">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isOwner
              ? 'Sign in with your owner or manager account.'
              : 'Sign in with your resident account.'}
          </p>

          {error && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          {choices && (
            <div className="mt-3 space-y-2">
              {choices.map((workspace) => (
                <button
                  key={workspace.slug}
                  type="button"
                  onClick={() => submitWith(workspace.slug)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm hover:border-[#2f5cff] hover:bg-blue-50"
                >
                  <span className="font-semibold text-slate-800">{workspace.name}</span>
                  <span className="mono-label text-[10px] text-slate-500">{workspace.slug} · {workspace.role}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Input
              label="Workspace slug (optional)"
              value={workspaceSlug}
              onChange={(e) => setWorkspaceSlug(e.target.value)}
              placeholder="e.g. sunrise-pg"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            {isOwner ? (
              <>New workspace? <Link className="font-semibold text-[#2f5cff]" to="/onboarding">Create one</Link></>
            ) : (
              <>No account yet? <Link className="font-semibold text-[#2f5cff]" to="/register">Register</Link></>
            )}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {isOwner ? (
              <>Resident? <Link className="font-semibold text-[#2f5cff]" to="/login/tenant">Sign in here</Link></>
            ) : (
              <>PG owner? <Link className="font-semibold text-[#2f5cff]" to="/login/owner">Sign in here</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
