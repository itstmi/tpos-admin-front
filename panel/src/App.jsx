import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import TabPage from './components/TabPage';
import { HOME } from './menu';
import Approvals from './pages/Approvals';
import Dashboard from './pages/Dashboard';
import ExportAll from './pages/ExportAll';
import Login from './pages/Login';
import NewIsp from './pages/NewIsp';
import IspLayout from './pages/isps/IspLayout';
import IspList from './pages/isps/IspList';
import { StaffLogs } from './pages/logs/Logs';
import Expenses from './pages/money/Expenses';
import Report from './pages/money/Report';
import Alerts from './pages/settings/Alerts';
import Password from './pages/settings/Password';
import WhatsApp from './pages/settings/WhatsApp';
import NewSubAdmin from './pages/subadmins/NewSubAdmin';
import SubAdminDetail from './pages/subadmins/SubAdminDetail';
import SubAdminList from './pages/subadmins/SubAdminList';

const REPORT_TABS = [
  { path: 'collection', label: 'Collection', element: Report },
  { path: 'expenses', label: 'Expenses', element: Expenses },
];

const SETTING_TABS = [
  { path: 'whatsapp', label: 'TPOS WhatsApp', element: WhatsApp },
  { path: 'alerts', label: 'Alerts', element: Alerts },
  { path: 'password', label: 'Password', element: Password },
  { path: 'activity', label: 'Activity Logs', element: StaffLogs },
  { path: 'export', label: 'Export All', element: ExportAll },
];

const Centered = ({ children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 p-4 text-center">
    {children}
  </div>
);

const Shell = () => {
  const { status } = useAuth();

  if (status === 'loading') {
    return <Centered><Loader2 size={32} className="animate-spin text-emerald-500" /></Centered>;
  }
  if (status === 'blocked') {
    return (
      <Centered>
        <p className="text-slate-600">Your email sign-in has expired.</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400"
        >
          <RefreshCw size={18} /> Reload
        </button>
      </Centered>
    );
  }
  if (status === 'out') return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/isps" element={<IspList />} />
        <Route path="/isps/:key/*" element={<IspLayout />} />
        <Route path="/new-isp" element={<NewIsp />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/sub-admins" element={<SubAdminList />} />
        <Route path="/sub-admins/:id/*" element={<SubAdminDetail />} />
        <Route path="/new-sub-admin" element={<NewSubAdmin />} />
        <Route path="/report/*" element={<TabPage base="/report" tabs={REPORT_TABS} />} />
        <Route path="/settings/*" element={<TabPage base="/settings" tabs={SETTING_TABS} />} />
        <Route path="*" element={<Navigate to={HOME} replace />} />
      </Routes>
    </Layout>
  );
};

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: '#333', color: '#fff' },
            success: { style: { background: '#22c55e' } },
            error: { style: { background: '#ef4444' } },
          }}
        />
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
