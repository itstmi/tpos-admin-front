import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MENU, isActive, pageTitle } from '../menu';

const linkClass = (active) => `
  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
  ${active
    ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-l-2 border-emerald-400'
    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
`;

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { admin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const close = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={close} />}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 overflow-y-auto transform transition-transform duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="TPOS" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">TPOS</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Super Admin</p>
            </div>
          </div>
          <button className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400" onClick={close}>
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1 mt-2">
          <p className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Menu</p>
          {MENU.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link key={item.path} to={item.path} onClick={close} className={linkClass(active)}>
                <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 h-20 flex items-center justify-between px-4 lg:px-8 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50">
          <button
            className="lg:hidden p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} className="text-slate-700 dark:text-slate-300" />
          </button>

          <div className="hidden lg:block">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{pageTitle(pathname)}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {admin?.name?.split(' ')[0]}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={20} className="text-slate-600" /> : <Sun size={20} className="text-amber-400" />}
            </button>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-white font-semibold shadow-md">
                {admin?.name?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{admin?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Super Admin</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>

        <footer className="px-4 lg:px-8 py-5 border-t border-slate-200/50 dark:border-slate-800/50">
          <p className="text-center text-xs tracking-wide text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} FAAH TECH (SMC-PRIVATE) LIMITED. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
