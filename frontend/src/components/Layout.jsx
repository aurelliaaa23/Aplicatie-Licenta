import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── SVG icon components ──────────────────────────────
const Icon = ({ d, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d={d} />
  </svg>
);

const icons = {
  home:      "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  folder:    "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  plus:      "M12 5v14M5 12h14",
  calendar:  "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  users:     "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  chart:     "M18 20V10M12 20V4M6 20v-6",
  bell:      "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  user:      "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8",
  logout:    "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  shield:    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  building:  "M3 21h18M9 21V7l3-4 3 4v14M9 14h6M9 10h6",
};

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icon.split('M').filter(Boolean).map((seg, i) => (
          <path key={i} d={`M${seg}`} />
        ))}
      </svg>
      {label}
      {badge > 0 && <span className="badge">{badge}</span>}
    </NavLink>
  );
}

export default function Layout({ children, title, notifCount = 0 }) {
  const { utilizator, logout } = useAuth();
  const navigate = useNavigate();
  const rol = utilizator?.rol || 'cetățean';

  const handleLogout = () => { logout(); navigate('/login'); };

  const initiale = utilizator
    ? `${utilizator.prenume?.[0] || ''}${utilizator.nume?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-badge">
            <div className="logo-icon">DG</div>
            <div>
              <h1>DGASPC</h1>
              <span>Platformă digitală</span>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-pill">
            <div className="user-avatar">{initiale}</div>
            <div className="user-info">
              <div className="user-name">{utilizator?.prenume} {utilizator?.nume}</div>
              <div className="user-role">{rol.replace(/_/g, ' ')}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Comun tuturor */}
          <div className="nav-section-label">General</div>
          <NavItem to="/dashboard" icon={icons.home} label="Panou principal" />
          <NavItem to="/profil" icon={icons.user} label="Profilul meu" />

          {/* Cetățean */}
          {rol === 'cetățean' && <>
            <div className="nav-section-label">Dosarele mele</div>
            <NavItem to="/dosare" icon={icons.folder} label="Dosare active" />
            <NavItem to="/dosar/nou" icon={icons.plus} label="Dosar nou" />
            <NavItem to="/programari" icon={icons.calendar} label="Programări" />
          </>}

          {/* Funcționar */}
          {(rol === 'funcționar' || rol === 'manager') && <>
            <div className="nav-section-label">Activitate</div>
            <NavItem to="/dosare" icon={icons.folder} label="Dosare alocate" badge={notifCount} />
            <NavItem to="/calendar" icon={icons.calendar} label="Calendar comisii" />
            <NavItem to="/colaborare" icon={icons.users} label="Colaborare externă" />
          </>}

          {/* Manager */}
          {(rol === 'manager' || rol === 'administrator') && <>
            <div className="nav-section-label">Management</div>
            <NavItem to="/rapoarte" icon={icons.chart} label="Rapoarte & statistici" />
            <NavItem to="/utilizatori" icon={icons.users} label="Utilizatori" />
          </>}

          {/* Actori externi */}
          {(rol === 'medic' || rol === 'funcționar_primărie' || rol === 'reprezentant_școală') && <>
            <div className="nav-section-label">Contribuții</div>
            <NavItem to="/dosare" icon={icons.folder} label="Dosare primite" />
          </>}

          {/* Admin */}
          {rol === 'administrator' && <>
            <div className="nav-section-label">Sistem</div>
            <NavItem to="/audit" icon={icons.shield} label="Audit log" />
          </>}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Deconectare
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions">
            {/* Buton notificări — gestionat în fiecare pagină */}
          </div>
        </header>
        <main className="page-body">
          {children}
        </main>
      </div>
    </div>
  );
}