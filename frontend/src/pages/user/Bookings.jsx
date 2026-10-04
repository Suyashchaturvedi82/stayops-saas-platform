import { useEffect, useState } from 'react';
import Badge from '../../components/common/Badge';
import Card from '../../components/common/Card';
import api from '../../api/axios';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBookings = async () => {
      try {
        const response = await api.get('/bookings/my');
        setBookings(response.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch bookings.');
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">BOOKING HISTORY</p>
        <h2 className="text-3xl font-bold text-slate-900">My Bookings</h2>
      </div>

      {loading && <p className="text-slate-500">Loading bookings...</p>}
      {!loading && error && <p className="text-rose-600">{error}</p>}
      {!loading && !error && bookings.length === 0 && <p className="text-slate-600">No bookings found.</p>}

      {!loading && !error && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking, index) => (
            <Card key={booking.id} className="stagger-enter relative" style={{ animationDelay: `${80 + index * 70}ms` }}>
              <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-[#2f5cff] to-[#00b894]" />
              <div className="ml-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-slate-900">
                    Booking #{bookings.length - index} - Room {booking.room_number}
                  </p>
                  <Badge type={booking.booking_status === 'APPROVED' ? 'success' : booking.booking_status === 'REJECTED' ? 'danger' : 'warning'}>
                    {booking.booking_status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">Bed {booking.bed_number}</p>
                <p className="text-sm text-slate-600">Check-in: {booking.check_in_date}</p>
                <p className="text-sm text-slate-600">Expected checkout: {booking.expected_check_out_date || 'N/A'}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
