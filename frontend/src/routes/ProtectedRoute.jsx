import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function ProtectedRoute({ children, requiredRole, requiredRoles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-600">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  const roleList = requiredRoles.length ? requiredRoles : requiredRole ? [requiredRole] : [];
  if (roleList.length && !user?.roles?.some((role) => roleList.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
