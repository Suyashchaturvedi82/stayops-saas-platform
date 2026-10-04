import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        //  - Conceptual visual trigger
        // Fetch dashboard stats from backend
        const statsRes = await api.get('/admin/stats'); 
        setStats(statsRes.data);
        
        // Fetch pending/recent bookings
        const bookingsRes = await api.get('/admin/bookings?limit=5'); 
        setRecentBookings(bookingsRes.data);
      } catch {
        console.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
        <span className="text-sm text-slate-500">Last updated: Just now</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Residents" value={stats?.residents || 0} icon="👥" color="indigo" />
        <StatCard title="Available Beds" value={stats?.availableBeds || 0} icon="🛏️" color="emerald" />
        <StatCard title="Monthly Revenue" value={`₹${stats?.revenue || 0}`} icon="💰" color="amber" />
        <StatCard title="Pending Requests" value={stats?.pendingRequests || 0} icon="⏳" color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings Table */}
        <div className="lg:col-span-2">
          <Card title="Recent Booking Requests" className="h-full">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-medium text-xs">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Room Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBookings.length > 0 ? recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{booking.userName}</td>
                      <td className="px-4 py-3">{booking.roomType}</td>
                      <td className="px-4 py-3">
                        <Badge type={booking.status === 'PENDING' ? 'warning' : 'success'}>
                          {booking.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">View</button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-400">No pending requests</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Quick Actions / Notices */}
        <div className="lg:col-span-1">
          <Card title="Quick Actions" className="h-full">
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                <span className="font-medium text-slate-700">Add New Room</span>
                <span className="text-slate-400">→</span>
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                <span className="font-medium text-slate-700">Record Payment</span>
                <span className="text-slate-400">→</span>
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                <span className="font-medium text-slate-700">Update Mess Menu</span>
                <span className="text-slate-400">→</span>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colorStyles = {
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600',
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colorStyles[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}