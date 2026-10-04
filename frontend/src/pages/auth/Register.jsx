import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import useAuth from '../../hooks/useAuth';

export default function Register() {
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone: '', gender: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const { register } = useAuth(); const navigate = useNavigate();
  const change = (event) => setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try { await register(formData); navigate('/login', { replace: true }); }
    catch (err) { setError(err.response?.data?.message || 'Registration failed.'); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen bg-slate-50 p-4 sm:p-8"><div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-10"><p className="mono-label text-xs text-slate-500">JOIN WORKSPACE</p><h1 className="mt-2 text-3xl font-bold">Create a resident account</h1><p className="mt-1 text-sm text-slate-500">Use the workspace selected during onboarding.</p>{error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2"><Input label="First Name" name="first_name" value={formData.first_name} onChange={change} required /><Input label="Last Name" name="last_name" value={formData.last_name} onChange={change} /><Input label="Email" type="email" name="email" value={formData.email} onChange={change} required /><Input label="Phone" name="phone" value={formData.phone} onChange={change} required /><div><label className="mb-1.5 block text-sm font-medium text-slate-700">Gender</label><select name="gender" value={formData.gender} onChange={change} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5" required><option value="">Select</option><option>MALE</option><option>FEMALE</option><option>OTHER</option></select></div><Input label="Password" type="password" name="password" value={formData.password} onChange={change} minLength={8} required /><Input label="Confirm Password" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={change} minLength={8} required /><Button type="submit" className="sm:col-span-2" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</Button></form><p className="mt-6 text-sm text-slate-600">Already registered? <Link className="font-semibold text-[#2f5cff]" to="/login">Sign in</Link></p></div></div>;
}
