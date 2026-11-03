import type { Role } from '@/stores/app-store';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Platform owner',
  SCHOOL_ADMIN: 'School admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
};

export const ROLE_SHORT: Record<Role, string> = {
  ADMIN: 'Owner',
  SCHOOL_ADMIN: 'Sub-admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function roleTone(role: Role): 'jade' | 'amber' | 'sky' | 'ink' {
  switch (role) {
    case 'ADMIN':
      return 'ink';
    case 'SCHOOL_ADMIN':
      return 'sky';
    case 'TEACHER':
      return 'amber';
    default:
      return 'jade';
  }
}
