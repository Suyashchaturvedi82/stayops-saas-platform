import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [bedsByRoom, setBedsByRoom] = useState({});
  const [expandedRoomId, setExpandedRoomId] = useState(null);
  const [selectedBedId, setSelectedBedId] = useState(null);
  const [checkInDate, setCheckInDate] = useState('');
  const [expectedCheckOutDate, setExpectedCheckOutDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const response = await api.get('/rooms');
        setRooms(response.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch rooms.');
      } finally {
        setLoading(false);
      }
    };

    loadRooms();
  }, []);

  const toggleRoom = async (roomId) => {
    setMessage('');

    if (expandedRoomId === roomId) {
      setExpandedRoomId(null);
      return;
    }

    setExpandedRoomId(roomId);

    if (!bedsByRoom[roomId]) {
      try {
        const response = await api.get(`/rooms/${roomId}/beds`);
        setBedsByRoom((prev) => ({ ...prev, [roomId]: response.data || [] }));
      } catch (err) {
        setMessage(err.response?.data?.message || 'Failed to fetch beds.');
      }
    }
  };

  const createBooking = async () => {
    if (!selectedBedId || !checkInDate) {
      setMessage('Please select a bed and check-in date.');
      return;
    }

    try {
      const response = await api.post('/bookings', {
        bed_id: selectedBedId,
        check_in_date: checkInDate,
        expected_check_out_date: expectedCheckOutDate || null,
      });

      setMessage(response.data?.message || 'Booking created successfully. Waiting for admin approval.');
      setSelectedBedId(null);
      setCheckInDate('');
      setExpectedCheckOutDate('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Booking failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label text-xs text-slate-500">ROOM INVENTORY</p>
        <h2 className="text-3xl font-bold text-slate-900">Available Rooms</h2>
      </div>

      {loading && <p className="text-slate-500">Loading rooms...</p>}
      {!loading && error && <p className="text-rose-600">{error}</p>}
      {message && <p className="text-slate-700 text-sm">{message}</p>}

      {!loading && !error && rooms.length === 0 && <p className="text-slate-500">No rooms available right now.</p>}

      {!loading && !error && rooms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rooms.map((room, index) => {
            const beds = bedsByRoom[room.id] || [];
            const availableBeds = beds.filter((bed) => bed.is_available);

            return (
              <Card
                key={room.id}
                className="stagger-enter relative overflow-hidden"
                style={{ animationDelay: `${80 + index * 70}ms` }}
                title={`Room ${room.room_number}`}
                subtitle={`${room.room_type} | Capacity ${room.max_occupancy}`}
              >
                <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[2rem] bg-gradient-to-br from-[#2f5cff]/10 to-[#00b894]/10" />

                <div className="relative space-y-3">
                  <p className="text-sm font-semibold text-slate-900">INR {room.rent_per_month} / month</p>

                  <Button variant="secondary" onClick={() => toggleRoom(room.id)}>
                    {expandedRoomId === room.id ? 'Hide Beds' : 'View Beds'}
                  </Button>

                  {expandedRoomId === room.id && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                      {beds.length === 0 && <p className="text-sm text-slate-500">No beds found for this room.</p>}

                      {beds.length > 0 && (
                        <div className="space-y-2">
                          {beds.map((bed) => (
                            <button
                              key={bed.id}
                              type="button"
                              disabled={!bed.is_available}
                              onClick={() => setSelectedBedId(bed.id)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                !bed.is_available
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                  : selectedBedId === bed.id
                                    ? 'border-[#2f5cff] bg-blue-50 text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>Bed {bed.bed_number}</span>
                                <Badge type={bed.is_available ? 'success' : 'neutral'}>
                                  {bed.is_available ? 'Available' : 'Occupied'}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs">INR {bed.rent_per_month} / month</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {availableBeds.length > 0 && (
                        <div className="space-y-2 border-t border-slate-100 pt-2">
                          <Input label="Check-in Date" type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
                          <Input
                            label="Expected Check-out Date (optional)"
                            type="date"
                            value={expectedCheckOutDate}
                            onChange={(e) => setExpectedCheckOutDate(e.target.value)}
                          />
                          <Button onClick={createBooking} disabled={!selectedBedId || !checkInDate}>
                            Book Selected Bed
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
