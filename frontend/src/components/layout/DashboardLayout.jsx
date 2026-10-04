import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AICopilot from '../common/AICopilot';

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return <div className="app-shell flex min-h-screen"><Sidebar open={mobileMenuOpen} onNavigate={()=>setMobileMenuOpen(false)} />{mobileMenuOpen && <button className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden" onClick={()=>setMobileMenuOpen(false)} aria-label="Close menu" />}<div className="flex min-h-screen flex-1 flex-col lg:pl-[280px]"><Navbar onMenuClick={()=>setMobileMenuOpen((prev)=>!prev)} /><main className="px-4 pb-20 pt-4 md:px-6 lg:px-8"><div className="page-enter"><Outlet /></div></main></div><AICopilot /></div>;
}
