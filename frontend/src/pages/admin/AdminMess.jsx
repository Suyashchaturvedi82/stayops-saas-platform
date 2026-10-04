import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import api from '../../api/axios';

export default function AdminMess() {
  const [plans, setPlans] = useState([]);
  const [todayStats, setTodayStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    plan_name: '',
    plan_type: 'SUBSCRIPTION',
    meals_per_day: '',
    price_per_month: '',
    price_per_meal: '',
  });

  const loadMessData = async () => {
    try {
      const [plansRes, statsRes] = await Promise.all([
        api.get('/mess/plans'),
        api.get('/mess/today'),
      ]);
      setPlans(plansRes.data || []);
      setTodayStats(statsRes.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load mess data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessData();
  }, []);

  const createPlan = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await api.post('/mess/plans', {
        plan_name: form.plan_name,
        plan_type: form.plan_type,
        meals_per_day: form.meals_per_day ? Number(form.meals_per_day) : null,
        price_per_month: form.price_per_month ? Number(form.price_per_month) : null,
        price_per_meal: form.price_per_meal ? Number(form.price_per_meal) : null,
      });
      setMessage('Mess plan created.');
      setForm({ plan_name: '', plan_type: 'SUBSCRIPTION', meals_per_day: '', price_per_month: '', price_per_meal: '' });
      loadMessData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Plan creation failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">ADMIN MESS OPS</p>
        <h2 className="text-3xl font-bold text-slate-900">Mess Plans & Today Stats</h2>
      </div>

      {message && <p className="text-sm text-slate-700">{message}</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Create Mess Plan" subtitle="Add subscription or pay-per-meal plan">
          <form className="space-y-3" onSubmit={createPlan}>
            <Input label="Plan Name" value={form.plan_name} onChange={(e) => setForm((p) => ({ ...p, plan_name: e.target.value }))} required />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Plan Type</label>
              <select
                value={form.plan_type}
                onChange={(e) => setForm((p) => ({ ...p, plan_type: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#2f5cff] focus:ring-4 focus:ring-blue-100"
              >
                <option value="SUBSCRIPTION">SUBSCRIPTION</option>
                <option value="PAY_PER_MEAL">PAY_PER_MEAL</option>
              </select>
            </div>

            <Input label="Meals Per Day" type="number" value={form.meals_per_day} onChange={(e) => setForm((p) => ({ ...p, meals_per_day: e.target.value }))} />
            <Input label="Price Per Month" type="number" value={form.price_per_month} onChange={(e) => setForm((p) => ({ ...p, price_per_month: e.target.value }))} />
            <Input label="Price Per Meal" type="number" value={form.price_per_meal} onChange={(e) => setForm((p) => ({ ...p, price_per_meal: e.target.value }))} />

            <Button type="submit" className="w-full">Create Plan</Button>
          </form>
        </Card>

        <Card title="Today's Meal Stats" subtitle="Consumed meals grouped by type">
          {loading && <p className="text-slate-500">Loading...</p>}
          {!loading && error && <p className="text-rose-600">{error}</p>}
          {!loading && !error && todayStats.length === 0 && <p className="text-slate-500">No meals logged today.</p>}
          {!loading && !error && todayStats.length > 0 && (
            <div className="space-y-3">
              {todayStats.map((item) => (
                <div key={item.meal_type} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{item.meal_type}</p>
                  <p className="text-sm text-slate-600">Count: {item.count}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2" title="Active Mess Plans" subtitle="Current active plan list">
          {loading && <p className="text-slate-500">Loading...</p>}
          {!loading && !error && plans.length === 0 && <p className="text-slate-500">No active plans.</p>}
          {!loading && !error && plans.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">#{plan.id} {plan.plan_name}</p>
                  <p className="text-sm text-slate-600">Type: {plan.plan_type}</p>
                  <p className="text-sm text-slate-600">Monthly: {plan.price_per_month || '-'} | Per Meal: {plan.price_per_meal || '-'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
