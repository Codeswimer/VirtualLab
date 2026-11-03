import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  LogOut,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCurrentUser, useOnlineStatus } from '@/hooks/use-app';
import { useAppStore, type Role } from '@/stores/app-store';
import { cn, initials } from '@/lib/utils';
import { ROLE_LABELS, ROLE_SHORT } from '@/lib/roles';
import { Badge } from '@/components/ui/primitives';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
}

const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/library', label: 'Laboratory', icon: LayoutGrid },
    { to: '/progress', label: 'My progress', icon: LineChart },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  ],
  TEACHER: [
    { to: '/dashboard', label: 'Class overview', icon: LayoutDashboard },
    { to: '/library', label: 'Laboratory', icon: LayoutGrid },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  ],
  SCHOOL_ADMIN: [
    { to: '/dashboard', label: 'School console', icon: ShieldCheck },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/library', label: 'Laboratory', icon: LayoutGrid },
    { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  ],
  ADMIN: [
    { to: '/dashboard', label: 'Owner console', icon: ShieldCheck },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  ],
};

const WORKSPACE_LABEL: Record<Role, string> = {
  STUDENT: 'Student workspace',
  TEACHER: 'Teacher workspace',
  SCHOOL_ADMIN: 'School administration',
  ADMIN: 'Platform administration',
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-jade-700 text-white shadow-[0_8px_20px_-10px_rgba(16,104,73,0.9)]">
        <FlaskConical className="h-[18px] w-[18px]" strokeWidth={2.2} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-ink-950 bg-amber-400" />
      </span>
      {!compact ? (
        <div className="leading-tight">
          <p className="text-[13px] font-bold tracking-tight text-white">Virtual Lab</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-jade-300">
            Nigeria
          </p>
        </div>
      ) : null}
    </div>
  );
}

function NavRow({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard'}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-white/10 text-white' : 'text-ink-200/80 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'h-[17px] w-[17px] transition-colors',
              isActive ? 'text-jade-300' : 'text-ink-300/70 group-hover:text-ink-100',
            )}
            strokeWidth={2}
          />
          <span>{label}</span>
          {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-jade-400" /> : null}
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const user = useCurrentUser();
  const online = useOnlineStatus();
  const signOut = useAppStore((state) => state.signOut);
  const schools = useAppStore((state) => state.schools);
  const accounts = useAppStore((state) => state.accounts);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const navItems = NAV[user.role];
  const school = schools.find((candidate) => candidate.id === user.schoolId);
  const pendingSchools = schools.filter((candidate) => candidate.status === 'PENDING').length;
  const pendingMembers = accounts.filter(
    (candidate) =>
      candidate.schoolId === user.schoolId && candidate.status === 'PENDING',
  ).length;
  const mobileItems = [
    ...navItems.slice(0, 3),
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="bench-dark sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col p-4 text-white lg:flex">
        <div className="px-2 pb-6 pt-3">
          <Brand />
        </div>

        <div className="px-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
            {user.role === 'STUDENT' ? 'Practice' : 'Workspace'}
          </p>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavRow key={item.to} {...item} />
          ))}
        </nav>

        <div className="mt-6 px-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
            {user.role === 'ADMIN' ? 'Platform' : 'This term'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-200">
            {user.role === 'ADMIN' ? (
              <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <GraduationCap className="h-3.5 w-3.5 text-amber-300" />
            )}
            <span className="truncate">
              {user.role === 'ADMIN' ? 'National roll-out' : user.role === 'STUDENT' ? user.classCode : school?.code ?? user.classCode}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-ink-300/80">
            {user.role === 'ADMIN' ? 'Virtual Lab Nigeria' : user.school}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-ink-400">
            {user.role === 'ADMIN'
              ? pendingSchools > 0
                ? `${pendingSchools} school application${pendingSchools === 1 ? '' : 's'} waiting for your approval.`
                : 'Every school application has been reviewed.'
              : user.role === 'SCHOOL_ADMIN'
                ? pendingMembers > 0
                  ? `${pendingMembers} member request${pendingMembers === 1 ? '' : 's'} waiting for approval.`
                  : 'Onboard students and teachers, then track class performance.'
                : user.role === 'TEACHER'
                  ? 'Review class submissions and add your own examiner marks.'
                  : `Grade ${user.gradeLevel} · work toward your WAEC practical.`}
          </p>
        </div>

        <div className="mt-auto space-y-1">
          <div
            className={cn(
              'mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium',
              online
                ? 'border-jade-500/30 bg-jade-500/10 text-jade-200'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-200',
            )}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? 'Online · submissions deliver' : 'Offline · work is saved'}
          </div>
          <NavRow to="/settings" label="Settings" icon={Settings} />
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300/80 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[17px] w-[17px]" />
            Sign out
          </button>
          <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-jade-500/20 font-mono text-[11px] font-bold text-jade-200">
              {initials(user.name)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="truncate text-[10px] text-ink-300">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-100/80 bg-paper/85 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-jade-700 text-white">
                  <FlaskConical className="h-4 w-4" />
                </span>
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                  Nigerian senior secondary practical lab
                </p>
                <p className="truncate text-sm font-semibold text-ink-800">
                  {WORKSPACE_LABEL[user.role]}
                </p>
              </div>
              <div className="sm:hidden">
                <p className="text-sm font-bold text-ink-900">Virtual Lab</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone={online ? 'jade' : 'amber'} className="hidden sm:inline-flex">
                {online ? (
                  <>
                    <Wifi className="h-3 w-3" /> Online
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" /> Offline
                  </>
                )}
              </Badge>
              <Badge tone="neutral" className="hidden items-center md:inline-flex">
                {user.role === 'ADMIN' ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : user.role === 'SCHOOL_ADMIN' ? (
                  <Users className="h-3 w-3" />
                ) : (
                  <GraduationCap className="h-3 w-3" />
                )}
                {user.role === 'ADMIN'
                  ? ROLE_SHORT.ADMIN
                  : user.role === 'SCHOOL_ADMIN'
                    ? school?.code ?? 'School'
                    : user.classCode}
              </Badge>
              <NavLink
                to="/settings"
                className="flex items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-3 transition-colors hover:border-ink-300"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 font-mono text-[10px] font-bold text-white">
                  {initials(user.name)}
                </span>
                <span className="max-w-[90px] truncate text-xs font-semibold text-ink-700">
                  {user.name.split(' ')[0]}
                </span>
              </NavLink>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-4">
          {mobileItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
                  isActive ? 'text-jade-800' : 'text-ink-400',
                )
              }
            >
              <item.icon className="h-5 w-5" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
