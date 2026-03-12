import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import MapView from './pages/MapView';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Analytics from './pages/Analytics';
import DriverPortal from './pages/DriverPortal';
import CustomerPortal from './pages/CustomerPortal';

// Role-based nav configs
const COMPANY_NAV = [
  { label:'Dashboard', icon:'⬡', path:'/',          section:'OVERVIEW' },
  { label:'Live Map',  icon:'◉', path:'/map',        section:null },
  { label:'Vehicles',  icon:'▣', path:'/vehicles',   section:'FLEET' },
  { label:'Trips',     icon:'⟶', path:'/trips',      section:null },
  { label:'Expenses',  icon:'◈', path:'/expenses',   section:'FINANCE' },
  { label:'Invoices',  icon:'◻', path:'/invoices',   section:null },
  { label:'Analytics', icon:'◆', path:'/analytics',  section:'REPORTS' },
];

const CUSTOMER_NAV = [
  { label:'My Bookings', icon:'⬡', path:'/', section:'CUSTOMER PORTAL' },
];

const DRIVER_NAV = [
  { label:'My Trip', icon:'🚛', path:'/', section:'DRIVER PORTAL' },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const NAV = user?.role === 'customer' ? CUSTOMER_NAV : user?.role === 'driver' ? DRIVER_NAV : COMPANY_NAV;
  const roleColor = user?.role === 'customer' ? '#3b82f6' : user?.role === 'driver' ? '#10b981' : '#f59e0b';
  const roleLabel = user?.role === 'customer' ? 'Customer' : user?.role === 'driver' ? 'Driver' : 'Company Admin';

  let lastSection = null;
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-badge">GOV-TMS</div>
        <h1>GovFleet</h1>
        <p>Transport Management</p>
      </div>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:'50%', background:`${roleColor}20`, border:`2px solid ${roleColor}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
          {user?.role === 'customer' ? '📦' : user?.role === 'driver' ? '🚛' : '🏢'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:roleColor, letterSpacing:1 }}>{roleLabel.toUpperCase()}</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(item => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <React.Fragment key={item.path}>
              {showSection && <div className="nav-section">{item.section}</div>}
              <button className={`nav-link ${isActive?'active':''}`} onClick={() => navigate(item.path)}>
                <span className="nav-icon">{item.icon}</span>{item.label}
              </button>
            </React.Fragment>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div style={{ marginBottom:10 }}>
          <span style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--text3)', letterSpacing:1 }}>SIGNED IN AS</span>
          <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>{user?.email}</div>
        </div>
        <button className="btn btn-danger btn-sm w-full" style={{ justifyContent:'center' }} onClick={logout}>Sign Out</button>
      </div>
    </div>
  );
}

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  if (user?.role === 'driver') {
    return (
      <Layout>
        <Routes>
          <Route path="*" element={<DriverPortal />} />
        </Routes>
      </Layout>
    );
  }

  if (user?.role === 'customer') {
    return (
      <Layout>
        <Routes>
          <Route path="*" element={<CustomerPortal />} />
        </Routes>
      </Layout>
    );
  }

  // Company admin - full access
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/map"       element={<MapView />} />
        <Route path="/vehicles"  element={<Vehicles />} />
        <Route path="/trips"     element={<Trips />} />
        <Route path="/trips/:id" element={<TripDetail />} />
        <Route path="/expenses"  element={<Expenses />} />
        <Route path="/invoices"  element={<Invoices />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Layout>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="loading"><div className="spinner"/>Loading GovFleet...</div>
    </div>
  );

  if (!user) {
    return showRegister
      ? <Register onSwitchLogin={() => setShowRegister(false)} />
      : <Login onSwitchRegister={() => setShowRegister(true)} />;
  }

  return <AppRoutes />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  );
}
