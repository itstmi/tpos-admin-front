import { Building2, CheckSquare, FileText, LayoutDashboard, Settings, Users } from 'lucide-react';

// Sidebar: one item per page. Sub menus live inside each page as tabs.
export const MENU = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/isps', label: 'ISPs', icon: Building2 },
  { path: '/approvals', label: 'Approvals', icon: CheckSquare },
  { path: '/sub-admins', label: 'Sub Admins', icon: Users },
  { path: '/report', label: 'Report', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const HOME = '/dashboard';

const under = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

export const isActive = (pathname, item) => [item.path, ...(item.also || [])].some((p) => under(pathname, p));

export function pageTitle(pathname) {
  return MENU.find((item) => isActive(pathname, item))?.label || '';
}
