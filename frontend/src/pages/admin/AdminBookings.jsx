import { useEffect, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import api from '../../api/axios';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadBookings = async () => {
    try {
      const res = await api.get('/bookings/pending');
      setBookings(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const action = async (id, type) => {
    setMessage('');
    try {
      await api.put(`/bookings/${id}/${type}`);
      setMessage(`Booking ${type}d successfully.`);
      loadBookings();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">ADMIN BOOKINGS</p>
        <h2 className="text-3xl font-bold text-slate-900">Pending Booking Requests</h2>
      </div>

      {message && <p className="text-sm text-slate-700">{message}</p>}

      <Card title="Approval Queue" subtitle="Approve or reject pending requests">
        {loading && <p className="text-slate-500">Loading...</p>}
        {!loading && error && <p className="text-rose-600">{error}</p>}
        {!loading && !error && bookings.length === 0 && <p className="text-slate-500">No pending bookings.</p>}

        {!loading && !error && bookings.length > 0 && (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{booking.email}</p>
                  <Badge type="warning">{booking.booking_status}</Badge>
                </div>
                <p className="text-sm text-slate-600 mt-1">Room {booking.room_number} - Bed {booking.bed_number}</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => action(booking.id, 'approve')}>Approve</Button>
                  <Button variant="secondary" onClick={() => action(booking.id, 'reject')}>
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
