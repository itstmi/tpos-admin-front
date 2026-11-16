import { Building2, CheckSquare, KeyRound, List, PlusCircle, Settings } from 'lucide-react';

// Sidebar menu. A group opens as a sub menu; only pages that exist are listed.
export const MENU = [
  {
    label: 'ISPs',
    icon: Building2,
    children: [
      { path: '/isps', label: 'All ISPs', icon: List },
      { path: '/new-isp', label: 'New ISP', icon: PlusCircle },
    ],
  },
  { path: '/approvals', label: 'Approvals', icon: CheckSquare },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { path: '/settings/password', label: 'Password', icon: KeyRound },
    ],
  },
];

export const HOME = '/isps';

export function pageTitle(pathname) {
  for (const item of MENU) {
    for (const child of item.children || [item]) {
      if (pathname === child.path || pathname.startsWith(`${child.path}/`)) {
        return item.children ? `${item.label} / ${child.label}` : child.label;
      }
    }
  }
  return '';
}
