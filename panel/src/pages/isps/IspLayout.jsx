import { useEffect } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api';
import { Card, ErrorBox, Loaded, StatusBadge, useLoad } from '../../components/ui';
import { isUuid, withSlugs } from './slug';
import { Activity, Bills, Controls, Import, Overview } from './tabs';

// ISP sub pages; Activity stays last
const TABS = [
  { path: 'overview', label: 'Overview', element: Overview },
  { path: 'bills', label: 'Bills', element: Bills },
  { path: 'import', label: 'Import', element: Import },
  { path: 'controls', label: 'Controls', element: Controls },
  { path: 'activity', label: 'Activity', element: Activity },
];

// The address holds the ISP's name. One call (the ISP list) finds it by name and also
// gives Customers, Collection and WhatsApp their numbers.
const IspLayout = () => {
  const { key } = useParams();
  const state = useLoad(() => api.isps().then((d) => withSlugs(d.isps)), []);
  const isp = state.data?.find((i) => i.slug === key || i.isp_id === key);

  return (
    <div className="space-y-5">
      <Link to="/isps" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600">
        <ArrowLeft size={16} /> All ISPs
      </Link>
      <Loaded state={state}>
        {() => (isp ? <Isp isp={isp} reloadIsp={state.reload} /> : <ErrorBox error={{ code: 'not_found' }} />)}
      </Loaded>
    </div>
  );
};

const Isp = ({ isp, reloadIsp }) => {
  const { key } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const id = isp.isp_id;

  // An old link with the id (Approvals) is changed to the name
  useEffect(() => {
    if (isUuid(key)) navigate(pathname.replace(`/isps/${key}`, `/isps/${isp.slug}`), { replace: true });
  }, [key, isp.slug, pathname, navigate]);

  return (
    <>
      <Card className="p-5 flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-bold text-slate-800 flex-1">{isp.business_name}</h3>
        <StatusBadge status={isp.status} />
      </Card>

      <div className="tabs-scroll">
        {TABS.map((t) => (
          <NavLink
            key={t.path}
            to={`/isps/${isp.slug}/${t.path}`}
            className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        {TABS.map((t) => (
          <Route key={t.path} path={t.path} element={<t.element isp={isp} ispId={id} reloadIsp={reloadIsp} ispSlug={isp.slug} />} />
        ))}
        <Route path="*" element={<Navigate to={`/isps/${isp.slug}/overview`} replace />} />
      </Routes>
    </>
  );
};

export default IspLayout;
