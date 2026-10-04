import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import UserDashboard from './pages/user/UserDashboard';
import Rooms from './pages/user/Rooms';
import Bookings from './pages/user/Bookings';
import Mess from './pages/user/Mess';
import Payments from './pages/user/Payments';
import Settlement from './pages/user/Settlement';
import Maintenance from './pages/user/Maintenance';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import TenantOnboarding from './pages/auth/TenantOnboarding';
import AdminOverview from './pages/admin/AdminOverview';
import AdminBookings from './pages/admin/AdminBookings';
import AdminPayments from './pages/admin/AdminPayments';
import AdminMess from './pages/admin/AdminMess';
import AdminCheckout from './pages/admin/AdminCheckout';
import ProtectedRoute from './routes/ProtectedRoute';
import useAuth from './hooks/useAuth';

function AuthLanding() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center">Loading...</div>;
  if (user) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  return <Navigate to="/onboarding" replace />;
}

const operatorRoles = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK'];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthLanding />} />
      <Route path="/onboarding" element={<TenantOnboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/mess" element={<Mess />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/maintenance" element={<Maintenance />} />
      </Route>

      <Route element={<ProtectedRoute requiredRoles={operatorRoles}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/overview" element={<AdminOverview />} />
        <Route path="/admin/bookings" element={<AdminBookings />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
        <Route path="/admin/mess" element={<AdminMess />} />
        <Route path="/admin/checkout" element={<AdminCheckout />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
