import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import api from '../../api/axios';

export default function AdminCheckout() {
  const [residents, setResidents] = useState([]);
  const [selectedResident, setSelectedResident] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    actual_move_out_date: new Date().toISOString().slice(0, 10),
    damage_deduction: '',
    other_charges: '',
    notes: '',
  });

  const loadResidents = async () => {
    try {
      const res = await api.get('/residents/active');
      setResidents(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load active residents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResidents();
  }, []);

  const fetchPreview = async () => {
    if (!selectedResident) return;
    setMessage('');
    try {
      const res = await api.get(`/checkout/${selectedResident}/preview`);
      setPreview(res.data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to fetch preview.');
    }
  };

  const confirmCheckout = async () => {
    if (!selectedResident) return;
    setMessage('');
    try {
      const res = await api.post(`/checkout/${selectedResident}/confirm`, {
        actual_move_out_date: form.actual_move_out_date,
        damage_deduction: Number(form.damage_deduction || 0),
        other_charges: Number(form.other_charges || 0),
        notes: form.notes || null,
      });
      setMessage(res.data?.message || 'Checkout completed.');
      setPreview(null);
      loadResidents();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Checkout failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">ADMIN CHECKOUT</p>
        <h2 className="text-3xl font-bold text-slate-900">Resident Checkout Desk</h2>
      </div>

      {message && <p className="text-sm text-slate-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Select Resident" subtitle="Pick active resident and load preview">
          {loading && <p className="text-slate-500">Loading...</p>}
          {!loading && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Resident</label>
                <select
                  value={selectedResident}
                  onChange={(e) => setSelectedResident(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#2f5cff] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select resident</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      #{resident.id} - {resident.email} (Room {resident.room_number}, Bed {resident.bed_number})
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={fetchPreview} disabled={!selectedResident}>Load Preview</Button>
            </div>
          )}
        </Card>

        <Card title="Preview" subtitle="Pending dues and refundable amount">
          {!preview && <p className="text-slate-500">No preview loaded.</p>}
          {preview && (
            <div className="space-y-2 text-sm">
              <p className="text-slate-700">Pending Rent: INR {preview.pendingRent}</p>
              <p className="text-slate-700">Refundable Amount: INR {preview.refundableAmount}</p>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2" title="Confirm Checkout" subtitle="Finalize resident checkout">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Move-out Date"
              type="date"
              value={form.actual_move_out_date}
              onChange={(e) => setForm((p) => ({ ...p, actual_move_out_date: e.target.value }))}
            />
            <Input
              label="Damage Deduction"
              type="number"
              value={form.damage_deduction}
              onChange={(e) => setForm((p) => ({ ...p, damage_deduction: e.target.value }))}
            />
            <Input
              label="Other Charges"
              type="number"
              value={form.other_charges}
              onChange={(e) => setForm((p) => ({ ...p, other_charges: e.target.value }))}
            />
            <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <Button className="mt-4" onClick={confirmCheckout} disabled={!selectedResident}>
            Confirm Checkout
          </Button>
        </Card>
      </div>
    </div>
  );
}
