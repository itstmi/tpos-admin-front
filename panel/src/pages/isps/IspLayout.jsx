import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api';
import { Card, Loaded, StatusBadge, useLoad } from '../../components/ui';
import { Activity, Bills, Collection, Controls, Customers, Export, Import, WhatsApp } from './tabs';

// ISP sub pages; Activity stays last
const TABS = [
  { path: 'customers', label: 'Customers', element: Customers },
  { path: 'collection', label: 'Collection', element: Collection },
  { path: 'whatsapp', label: 'WhatsApp', element: WhatsApp },
  { path: 'bills', label: 'Bills', element: Bills },
  { path: 'export', label: 'Export', element: Export },
  { path: 'import', label: 'Import', element: Import },
  { path: 'controls', label: 'Controls', element: Controls },
  { path: 'activity', label: 'Activity', element: Activity },
];

const IspLayout = () => {
  const { id } = useParams();
  // One stats call per ISP; Customers, Collection and WhatsApp all read from it
  const state = useLoad(() => api.isp(id).then((d) => d.isp), [id]);

  return (
    <div className="space-y-5">
      <Link to="/isps" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600">
        <ArrowLeft size={16} /> All ISPs
      </Link>
      <Loaded state={state}>
        {(isp) => (
          <>
            <Card className="p-5 flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-bold text-slate-800 flex-1">{isp.business_name}</h3>
              <StatusBadge status={isp.status} />
            </Card>

            <div className="tabs-scroll">
              {TABS.map((t) => (
                <NavLink
                  key={t.path}
                  to={`/isps/${id}/${t.path}`}
                  className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t.label}
                </NavLink>
              ))}
            </div>

            <Routes>
              {TABS.map((t) => (
                <Route key={t.path} path={t.path} element={<t.element isp={isp} ispId={id} reloadIsp={state.reload} />} />
              ))}
              <Route path="*" element={<Navigate to="customers" replace />} />
            </Routes>
          </>
        )}
      </Loaded>
    </div>
  );
};

export default IspLayout;
