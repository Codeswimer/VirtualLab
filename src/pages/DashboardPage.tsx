import { useCurrentUser } from '@/hooks/use-app';
import { StudentDashboard } from '@/pages/dashboards/StudentDashboard';
import { TeacherDashboard } from '@/pages/dashboards/TeacherDashboard';
import { SchoolDashboard } from '@/pages/dashboards/SchoolDashboard';
import { AdminDashboard } from '@/pages/dashboards/AdminDashboard';

/**
 * Role router. Each role gets its own console rather than sharing one layout with
 * hidden panels, so permissions are obvious in the component tree.
 */
export function DashboardPage() {
  const user = useCurrentUser();
  if (!user) return null;
  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'SCHOOL_ADMIN':
      return <SchoolDashboard />;
    case 'TEACHER':
      return <TeacherDashboard />;
    default:
      return <StudentDashboard />;
  }
}
