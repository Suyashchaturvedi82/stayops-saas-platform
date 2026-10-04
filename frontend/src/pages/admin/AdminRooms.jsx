import { useEffect, useState } from 'react';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import api from '../../api/axios';

const initial = { room_number: '', floor_number: 1, room_type: 'NON_AC', max_occupancy: 2, rent_per_month: '', description: '' };

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [bedCounts, setBedCounts] = useState({});
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
      const counts = {};
      await Promise.all(data.map(async (room) => {
        const res = await api.get(`/rooms/${room.id}/beds`);
        counts[room.id] = res.data.length;
      }));
      setBedCounts(counts);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load rooms.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const addBeds = async (roomId, rent, from, to) => {
    for (let i = from; i <= to; i += 1) {
      await api.post('/beds', { room_id: roomId, bed_number: `B${i}`, rent_per_month: rent });
    }
  };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setMessage(''); setSaving(true);
    try {
      const capacity = Number(form.max_occupancy);
      const { data } = await api.post('/rooms', { ...form, floor_number: Number(form.floor_number), max_occupancy: capacity, rent_per_month: Number(form.rent_per_month) });
      await addBeds(data.roomId, Number(form.rent_per_month), 1, capacity);
      setMessage(`Room ${form.room_number} added with ${capacity} bed(s). It is now bookable.`);
      setForm(initial);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add room.');
    } finally { setSaving(false); }
  };

  const addOneBed = async (room) => {
    setError(''); setMessage('');
    try {
      await addBeds(room.id, Number(room.rent_per_month), (bedCounts[room.id] || 0) + 1, (bedCounts[room.id] || 0) + 1);
      setMessage(`Bed added to room ${room.room_number}.`);
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Could not add bed.'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mono-label text-xs text-slate-500">INVENTORY</p>
        <h1 className="text-3xl font-bold text-slate-900">Rooms & Beds</h1>
        <p className="text-sm text-slate-500">Residents can book only beds that exist here.</p>
      </div>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Room Number" name="room_number" value={form.room_number} onChange={change} placeholder="101" required />
        <Input label="Floor" type="number" min="0" name="floor_number" value={form.floor_number} onChange={change} required />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Room Type</label>
          <select name="room_type" value={form.room_type} onChange={change} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <option value="NON_AC">Non-AC</option><option value="AC">AC</option>
          </select>
        </div>
        <Input label="Beds in room" type="number" min="1" max="12" name="max_occupancy" value={form.max_occupancy} onChange={change} required />
        <Input label="Rent per bed / month (INR)" type="number" min="1" name="rent_per_month" value={form.rent_per_month} onChange={change} required />
        <Input label="Description (optional)" name="description" value={form.description} onChange={change} />
        <Button type="submit" className="sm:col-span-2 lg:col-span-3" disabled={saving}>{saving ? 'Adding...' : 'Add Room & Create Beds'}</Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>
            <th className="px-4 py-3">Room</th><th className="px-4 py-3">Floor</th><th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Beds</th><th className="px-4 py-3">Rent / bed</th><th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {loading ? <tr><td className="px-4 py-6 text-slate-500" colSpan="6">Loading...</td></tr>
              : rooms.length === 0 ? <tr><td className="px-4 py-6 text-slate-500" colSpan="6">No rooms yet. Add your first room above.</td></tr>
              : rooms.map((room) => (
                <tr key={room.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{room.room_number}</td>
                  <td className="px-4 py-3">{room.floor_number}</td>
                  <td className="px-4 py-3">{room.room_type}</td>
                  <td className="px-4 py-3">{bedCounts[room.id] ?? '-'}</td>
                  <td className="px-4 py-3">INR {room.rent_per_month}</td>
                  <td className="px-4 py-3 text-right"><Button variant="secondary" onClick={() => addOneBed(room)}>+ Bed</Button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}