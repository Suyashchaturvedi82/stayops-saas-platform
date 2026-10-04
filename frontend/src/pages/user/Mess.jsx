import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import api from '../../api/axios';

export default function Mess() {
  const [messInfo, setMessInfo] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [mealType, setMealType] = useState('BREAKFAST');
  const [actionMsg, setActionMsg] = useState('');

  const loadMessData = async () => {
    try {
      const [meRes, plansRes] = await Promise.all([api.get('/mess/me'), api.get('/mess/plans')]);
      setMessInfo(meRes.data?.activeSubscription || null);
      setPlans(plansRes.data || []);
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

  const subscribe = async (planId) => {
    setActionMsg('');
    try {
      await api.post('/mess/subscribe', { mess_plan_id: planId });
      setActionMsg('Plan activated successfully.');
      loadMessData();
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Plan activation failed.');
    }
  };

  const logMeal = async () => {
    setActionMsg('');
    try {
      await api.post('/mess/meal', { meal_type: mealType });
      setActionMsg(`${mealType} logged successfully.`);
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Meal log failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">MESS SERVICES</p>
        <h2 className="text-3xl font-bold text-slate-900">Mess & Meals</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Current Plan" subtitle="Live status from backend">
          {loading && <p className="text-slate-500">Loading...</p>}
          {!loading && error && <p className="text-rose-600">{error}</p>}
          {!loading && !error && messInfo && (
            <div className="space-y-3 text-sm">
              <Row label="Plan" value={messInfo.plan_name} />
              <Row label="Type" value={messInfo.plan_type} />
              <Row label="Status" value={<Badge type="success">{messInfo.subscription_status}</Badge>} />
              <Row label="Payment" value={messInfo.payment_status} />
            </div>
          )}
          {!loading && !error && !messInfo && <p className="text-slate-500">No active mess plan.</p>}
        </Card>

        <Card title="Available Plans" subtitle="Pick any active plan">
          {loading && <p className="text-slate-500">Loading plans...</p>}
          {!loading && !error && plans.length === 0 && (
            <p className="text-slate-500">No plans found. Create plans from Admin Mess Ops.</p>
          )}

          {!loading && !error && plans.length > 0 && (
            <div className="space-y-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{plan.plan_name}</p>
                    <Badge type={plan.plan_type === 'SUBSCRIPTION' ? 'info' : 'warning'}>{plan.plan_type}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">Meals/Day: {plan.meals_per_day ?? '-'}</p>
                  <p className="text-sm text-slate-600">
                    Monthly: {plan.price_per_month ?? '-'} | Per Meal: {plan.price_per_meal ?? '-'}
                  </p>
                  <Button className="mt-3" onClick={() => subscribe(plan.id)} disabled={Boolean(messInfo)}>
                    {messInfo ? 'Already Active' : 'Activate Plan'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2" title="Log Meal" subtitle="Works only with active PAY_PER_MEAL plan">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Meal Type</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#2f5cff] focus:ring-4 focus:ring-blue-100"
              >
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="DINNER">Dinner</option>
              </select>
            </div>
            <Button onClick={logMeal}>Log Meal</Button>
          </div>
          {actionMsg && <p className="mt-4 text-sm text-slate-700">{actionMsg}</p>}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
