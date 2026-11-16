import {
  BellRing, Building2, CheckSquare, Download, FileText, KeyRound, List, LogIn, MessageCircle,
  PlusCircle, Receipt, ScrollText, Settings, UserPlus, Users, Wallet,
} from 'lucide-react';

// Sidebar menu. A group opens as a sub menu.
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
    label: 'Sub Admins',
    icon: Users,
    children: [
      { path: '/sub-admins', label: 'All Sub Admins', icon: List },
      { path: '/new-sub-admin', label: 'New Sub Admin', icon: UserPlus },
    ],
  },
  {
    label: 'Money',
    icon: Wallet,
    children: [
      { path: '/money/report', label: 'Report', icon: FileText },
      { path: '/money/expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  { path: '/export', label: 'Export All', icon: Download },
  {
    label: 'Logs',
    icon: ScrollText,
    children: [
      { path: '/logs/logins', label: 'Login Logs', icon: LogIn },
      { path: '/logs/staff', label: 'Staff Logs', icon: ScrollText },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { path: '/settings/whatsapp', label: 'TPOS WhatsApp', icon: MessageCircle },
      { path: '/settings/alerts', label: 'Alerts', icon: BellRing },
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
