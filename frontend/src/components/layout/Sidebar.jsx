import { NavLink, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const residentItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '01' },
  { to: '/rooms', label: 'Rooms & Beds', icon: '02' },
  { to: '/bookings', label: 'Bookings', icon: '03' },
  { to: '/mess', label: 'Mess', icon: '04' },
  { to: '/payments', label: 'Payments', icon: '05' },
  { to: '/maintenance', label: 'Maintenance', icon: '06' },
  { to: '/settlement', label: 'Settlement', icon: '07' },
];
const adminItems = [
  { to: '/admin/overview', label: 'Command Center', icon: 'A1' },
  { to: '/admin/bookings', label: 'Bookings', icon: 'A2' },
  { to: '/admin/payments', label: 'Payments', icon: 'A3' },
  { to: '/admin/mess', label: 'Mess Ops', icon: 'A4' },
  { to: '/admin/checkout', label: 'Checkout', icon: 'A5' },
  { to: '/maintenance', label: 'Maintenance', icon: 'A6' },
];

export default function Sidebar({ open, onNavigate }) {
  const { user } = useAuth(); const location = useLocation();
  const isOperator = user?.roles?.some((role) => ['OWNER','MANAGER','ACCOUNTANT','FRONTDESK'].includes(role));
  const isAdminArea = location.pathname.startsWith('/admin');
  const navItems = isOperator && isAdminArea ? adminItems : residentItems;
  return <aside className={`fixed left-0 top-0 z-40 h-full w-[280px] transform border-r border-white/10 bg-[#0c1228] text-white transition-transform duration-300 lg:translate-x-0 ${open?'translate-x-0':'-translate-x-full'}`}><div className="flex h-full flex-col p-6"><div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="mono-label text-xs text-blue-200">STAYOPS AI</p><h1 className="mt-2 text-2xl font-bold">Operations Center</h1><p className="mt-1 text-sm text-slate-400">PG, mess & resident workflows.</p></div><nav className="space-y-2 overflow-y-auto">{navItems.map((item,index)=><NavLink key={item.to} to={item.to} onClick={onNavigate} style={{animationDelay:`${70+index*50}ms`}} className={({isActive})=>`stagger-enter flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${isActive?'bg-white text-slate-900 shadow-sm':'text-blue-100 hover:bg-white/10'}`}><span className="mono-label text-xs opacity-70">{item.icon}</span><span>{item.label}</span></NavLink>)}</nav><div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-400">AI copilot is available from every dashboard screen.</div></div></aside>;
}
