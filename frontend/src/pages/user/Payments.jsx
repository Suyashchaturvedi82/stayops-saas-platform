import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import api from '../../api/axios';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    booking_id: '',
    payment_for: 'RENT',
    amount: '',
    upi_transaction_id: '',
    payment_screenshot_url: '',
  });

  const loadPayments = async () => {
    try {
      const res = await api.get('/payments/my');
      setPayments(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const submitPayment = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await api.post('/payments', {
        booking_id: form.booking_id ? Number(form.booking_id) : null,
        payment_for: form.payment_for,
        amount: Number(form.amount),
        upi_transaction_id: form.upi_transaction_id || null,
        payment_screenshot_url: form.payment_screenshot_url,
      });
      setMessage('Payment submitted successfully.');
      setForm({
        booking_id: '',
        payment_for: 'RENT',
        amount: '',
        upi_transaction_id: '',
        payment_screenshot_url: '',
      });
      loadPayments();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Payment submission failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">PAYMENTS</p>
        <h2 className="text-3xl font-bold text-slate-900">Payments & Verification</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Submit Payment" subtitle="Upload UPI payment details">
          <form className="space-y-3" onSubmit={submitPayment}>
            <Input label="Booking ID (optional)" value={form.booking_id} onChange={(e) => setForm((p) => ({ ...p, booking_id: e.target.value }))} />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment For</label>
              <select
                value={form.payment_for}
                onChange={(e) => setForm((p) => ({ ...p, payment_for: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#2f5cff] focus:ring-4 focus:ring-blue-100"
              >
                <option value="RENT">Rent</option>
                <option value="MESS">Mess</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <Input label="Amount" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required />
            <Input label="UPI Transaction ID" value={form.upi_transaction_id} onChange={(e) => setForm((p) => ({ ...p, upi_transaction_id: e.target.value }))} />
            <Input
              label="Screenshot URL"
              value={form.payment_screenshot_url}
              onChange={(e) => setForm((p) => ({ ...p, payment_screenshot_url: e.target.value }))}
              required
            />

            <Button type="submit" className="w-full">
              Submit Payment
            </Button>
          </form>
          {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
        </Card>

        <Card title="My Payment Records" subtitle="Latest first">
          {loading && <p className="text-slate-500">Loading...</p>}
          {!loading && error && <p className="text-rose-600">{error}</p>}
          {!loading && !error && payments.length === 0 && <p className="text-slate-500">No payment records found.</p>}
          {!loading && !error && payments.length > 0 && (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{payment.payment_for}</p>
                    <Badge
                      type={
                        payment.payment_status === 'VERIFIED'
                          ? 'success'
                          : payment.payment_status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {payment.payment_status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Amount: INR {payment.amount}</p>
                  <p className="text-sm text-slate-600">Date: {payment.payment_date}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
