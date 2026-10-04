import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import api from '../../api/axios';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('Invalid payment proof');

  const loadPendingPayments = async () => {
    try {
      const res = await api.get('/payments/pending');
      setPayments(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const verify = async (id) => {
    setMessage('');
    try {
      await api.put(`/payments/${id}/verify`);
      setMessage('Payment verified.');
      loadPendingPayments();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Verify failed.');
    }
  };

  const reject = async (id) => {
    setMessage('');
    try {
      await api.put(`/payments/${id}/reject`, { reason: rejectReason });
      setMessage('Payment rejected.');
      loadPendingPayments();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Reject failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">ADMIN PAYMENTS</p>
        <h2 className="text-3xl font-bold text-slate-900">Payment Verification</h2>
      </div>

      <Card title="Pending Payments" subtitle="Verify or reject payment submissions">
        <Input label="Default Rejection Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}

        {loading && <p className="mt-4 text-slate-500">Loading...</p>}
        {!loading && error && <p className="mt-4 text-rose-600">{error}</p>}
        {!loading && !error && payments.length === 0 && <p className="mt-4 text-slate-500">No pending payments.</p>}

        {!loading && !error && payments.length > 0 && (
          <div className="mt-4 space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{payment.email}</p>
                  <Badge type="warning">{payment.payment_status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">INR {payment.amount} - {payment.payment_for}</p>
                <p className="text-sm text-slate-600">Screenshot: {payment.payment_screenshot_url}</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => verify(payment.id)}>Verify</Button>
                  <Button variant="secondary" onClick={() => reject(payment.id)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
