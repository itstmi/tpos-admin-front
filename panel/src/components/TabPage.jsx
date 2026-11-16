import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

// A page whose sub menu sits inside the window as tabs (not in the sidebar)
const TabPage = ({ base, tabs }) => (
  <div className="space-y-5">
    <div className="tabs-scroll">
      {tabs.map((t) => (
        <NavLink
          key={t.path}
          to={`${base}/${t.path}`}
          className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
    <Routes>
      {tabs.map((t) => <Route key={t.path} path={t.path} element={<t.element />} />)}
      <Route path="*" element={<Navigate to={tabs[0].path} replace />} />
    </Routes>
  </div>
);

export default TabPage;
