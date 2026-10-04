import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import api from '../../api/axios';

export default function Settlement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSettlement = async () => {
      try {
        const res = await api.get('/checkout/me');
        setData(res.data || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load settlement status.');
      } finally {
        setLoading(false);
      }
    };

    loadSettlement();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">SETTLEMENT</p>
        <h2 className="text-3xl font-bold text-slate-900">Final Settlement</h2>
      </div>

      <Card title="Checkout Settlement" subtitle="Latest settled record">
        {loading && <p className="text-slate-500">Loading...</p>}
        {!loading && error && <p className="text-rose-600">{error}</p>}
        {!loading && !error && !data && <p className="text-slate-500">No settlement available yet.</p>}
        {!loading && !error && data && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Refundable Amount</span>
              <span className="font-semibold text-slate-900">INR {data.refundable_amount}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Settlement Date</span>
              <span className="font-semibold text-slate-900">{data.final_settlement_date || 'N/A'}</span>
            </div>
            <Badge type="info">Settled</Badge>
          </div>
        )}
      </Card>
    </div>
  );
}
