import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCopy,
  GraduationCap,
  Layers,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-app';
import { useAppStore } from '@/stores/app-store';
import { leaderboardForScope, studentMetrics } from '@/lib/leaderboard';
import { cn, initials } from '@/lib/utils';
import {
  Badge,
  EmptyState,
  IconButton,
  Modal,
  SectionHeading,
  Tabs,
} from '@/components/ui/primitives';
import {
  GradePill,
  PageHeading,
  RankMedal,
  StatCard,
  StatusPill,
} from '@/components/dashboard/kit';

type MemberTab = 'students' | 'teachers';

export function SchoolDashboard() {
  const user = useCurrentUser();
  const accounts = useAppStore((state) => state.accounts);
  const attempts = useAppStore((state) => state.attempts);
  const schools = useAppStore((state) => state.schools);
  const leaderboard = useAppStore((state) => state.leaderboard);
  const createMember = useAppStore((state) => state.createMember);
  const setMemberStatus = useAppStore((state) => state.setMemberStatus);

  const [tab, setTab] = useState<MemberTab>('students');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    classCode: '',
    gradeLevel: 'SS2',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const school = schools.find((candidate) => candidate.id === user?.schoolId);
  const members = accounts.filter((account) => account.schoolId === user?.schoolId);
  const students = members.filter((account) => account.role === 'STUDENT');
  const teachers = members.filter((account) => account.role === 'TEACHER');
  const pending = members
    .filter((account) => account.status === 'PENDING')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeStudents = students.filter((account) => account.status === 'ACTIVE');

  const schoolBoard = useMemo(
    () => leaderboardForScope(leaderboard, 'school', user?.schoolId ?? null),
    [leaderboard, user?.schoolId],
  );

  const submissions = attempts.filter(
    (attempt) =>
      attempt.status === 'SCORED' &&
      members.some((member) => member.id === attempt.studentId),
  ).length;
  const classes = new Set(activeStudents.map((student) => student.classCode)).size;
  const schoolAverage =
    schoolBoard.length === 0
      ? 0
      : Math.round(
          (schoolBoard.reduce((sum, entry) => sum + entry.average, 0) / schoolBoard.length) * 10,
        ) / 10;

  const roster = (tab === 'students' ? students : teachers).filter((member) => {
    const text = `${member.name} ${member.email} ${member.classCode}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  const openAdd = () => {
    setForm({ name: '', email: '', classCode: '', gradeLevel: 'SS2' });
    setFormError(null);
    setCredentials(null);
    setModalOpen(true);
  };

  const submitMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.schoolId) return;
    setSaving(true);
    const result = await createMember({
      schoolId: user.schoolId,
      name: form.name,
      email: form.email,
      role: tab === 'students' ? 'STUDENT' : 'TEACHER',
      classCode: form.classCode,
      gradeLevel: tab === 'students' ? form.gradeLevel : 'Staff',
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    if (result.credentials) setCredentials(result.credentials);
  };

  const changeStatus = async (memberId: string, status: 'ACTIVE' | 'REVOKED') => {
    setActionError(await setMemberStatus(memberId, status));
  };

  if (!user || !school) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeading
        eyebrow="School console · sub-admin"
        title={school.name}
        subtitle={`${school.city}, ${school.state} · join code ${school.code}`}
        actions={
          <>
            <Badge tone={school.status === 'APPROVED' ? 'jade' : school.status === 'PENDING' ? 'amber' : 'red'}>
              <ShieldCheck className="h-3 w-3" />
              {school.status === 'APPROVED'
                ? 'Approved by platform owner'
                : school.status === 'PENDING'
                  ? 'Awaiting platform approval'
                  : 'Access revoked'}
            </Badge>
            <button type="button" className="btn-primary btn-sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Add {tab === 'students' ? 'student' : 'teacher'}
            </button>
          </>
        }
      />

      {actionError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {actionError}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active students" value={String(activeStudents.length)} hint={`${students.length} on roll`} icon={Users} />
        <StatCard label="Teachers" value={String(teachers.filter((teacher) => teacher.status === 'ACTIVE').length)} hint="marking your classes" icon={GraduationCap} tone="amber" />
        <StatCard label="Classes" value={String(classes)} hint="with active students" icon={Layers} tone="sky" />
        <StatCard label="School average" value={`${schoolAverage.toFixed(1)}%`} hint={`${submissions} submissions`} icon={Trophy} tone="ink" />
      </div>

      {pending.length > 0 ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-2 border-b border-amber-200/70 px-4 py-3">
            <UserCheck className="h-4 w-4 text-amber-700" />
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              {pending.length} access request{pending.length === 1 ? '' : 's'} waiting
            </p>
            <p className="ml-auto hidden text-[10px] text-amber-700/80 sm:block">
              Students who used your join code {school.code}
            </p>
          </div>
          <div className="divide-y divide-amber-200/60">
            {pending.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-mono text-[10px] font-bold text-amber-800">
                  {initials(member.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink-900">{member.name}</p>
                  <p className="truncate text-[10px] text-ink-500">
                    {member.email} · {member.role === 'STUDENT' ? `${member.gradeLevel} ${member.classCode}` : 'Teacher'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => void changeStatus(member.id, 'ACTIVE')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => void changeStatus(member.id, 'REVOKED')}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              tabs={[
                { id: 'students', label: 'Students', badge: students.length },
                { id: 'teachers', label: 'Teachers', badge: teachers.length },
              ]}
              value={tab}
              onChange={(id) => {
                setTab(id as MemberTab);
                setQuery('');
              }}
            />
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${tab}…`}
                className="input py-1.5 pl-8 text-xs"
                aria-label={`Search ${tab}`}
              />
            </div>
          </div>

          {roster.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<UserPlus className="h-6 w-6" />}
                title={`No ${tab} yet`}
                body="Add members directly and share their temporary password, or let them request access with your school join code."
                action={
                  <button type="button" className="btn-primary btn-sm" onClick={openAdd}>
                    <Plus className="h-3.5 w-3.5" /> Add {tab === 'students' ? 'student' : 'teacher'}
                  </button>
                }
              />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="py-2 pr-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Member</th>
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Class</th>
                    {tab === 'students' ? (
                      <>
                        <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Average</th>
                        <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Grade</th>
                      </>
                    ) : (
                      <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Submissions marked</th>
                    )}
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Access</th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-ink-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((member) => {
                    const metrics = studentMetrics(attempts, member.id);
                    const marked = attempts.filter(
                      (attempt) => attempt.review?.reviewerId === member.id,
                    ).length;
                    return (
                      <tr key={member.id} className="border-b border-ink-50 last:border-0">
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 font-mono text-[10px] font-bold text-ink-700">
                              {initials(member.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-ink-800">{member.name}</p>
                              <p className="truncate text-[10px] text-ink-400">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 font-mono text-[10px] text-ink-600">
                          {member.role === 'STUDENT' ? `${member.gradeLevel} · ${member.classCode}` : member.classCode}
                        </td>
                        {tab === 'students' ? (
                          <>
                            <td className="px-2 py-2.5">
                              <span className="font-mono text-xs font-semibold text-ink-700">
                                {metrics.submissions > 0 ? `${metrics.average.toFixed(0)}%` : '—'}
                              </span>
                            </td>
                            <td className="px-2 py-2.5">
                              {metrics.submissions > 0 ? <GradePill grade={metrics.grade} /> : <span className="text-[10px] text-ink-400">No work</span>}
                            </td>
                          </>
                        ) : (
                          <td className="px-2 py-2.5 font-mono text-xs text-ink-600">{marked}</td>
                        )}
                        <td className="px-2 py-2.5">
                          <StatusPill status={member.status} />
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          {member.status === 'PENDING' ? (
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => void changeStatus(member.id, 'ACTIVE')}
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={cn(
                                'btn-sm',
                                member.status === 'REVOKED'
                                  ? 'btn-secondary'
                                  : 'btn-ghost text-red-600 hover:bg-red-50',
                              )}
                              onClick={() => {
                                if (
                                  member.status !== 'REVOKED' &&
                                  !window.confirm(
                                    `Revoke access for ${member.name}? Their work is kept, but they cannot sign in.`,
                                  )
                                ) {
                                  return;
                                }
                                void changeStatus(
                                  member.id,
                                  member.status === 'REVOKED' ? 'ACTIVE' : 'REVOKED',
                                );
                              }}
                            >
                              {member.status === 'REVOKED' ? 'Restore' : 'Revoke'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[10px] text-ink-400">
            Revoking keeps every submission for your records but blocks sign-in immediately.
          </p>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <SectionHeading title="School join code" subtitle="Share with students in your classes." />
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-dashed border-jade-300 bg-jade-50 px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.14em] text-jade-900">
                {school.code}
              </code>
              <IconButton label="Copy join code" onClick={() => copy(school.code, 'code')}>
                {copied === 'code' ? <Check className="h-4 w-4 text-jade-700" /> : <ClipboardCopy className="h-4 w-4" />}
              </IconButton>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
              New students create an account with this code and wait in the requests panel above. You
              can also add them directly with a temporary password.
            </p>
          </section>

          <section className="card p-5">
            <SectionHeading
              title="School leaderboard"
              subtitle="Best score per practical, averaged."
              action={
                <Link to="/leaderboard" className="inline-flex items-center gap-1 text-[11px] font-semibold text-jade-800">
                  All <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <div className="mt-3 space-y-1.5">
              {schoolBoard.slice(0, 5).map((entry) => (
                <div key={entry.studentId} className="flex items-center gap-2 rounded-lg border border-ink-50 px-2.5 py-2">
                  <RankMedal rank={entry.schoolRank} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold text-ink-800">{entry.name}</p>
                    <p className="text-[9.5px] text-ink-400">{entry.classCode}</p>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-ink-600">
                    {entry.average.toFixed(0)}%
                  </span>
                  <GradePill grade={entry.grade} />
                </div>
              ))}
              {schoolBoard.length === 0 ? (
                <p className="text-xs text-ink-500">Marks will appear here as classes submit practicals.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              <Mail className="h-3 w-3" /> Need help?
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
              If your school access is revoked, contact the platform owner at{' '}
              <span className="font-semibold text-ink-700">owner@vlab.ng</span>. School admins cannot
              change their own status.
            </p>
          </section>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={credentials ? 'Account created' : `Add a ${tab === 'students' ? 'student' : 'teacher'}`}
        description={
          credentials
            ? 'Share these sign-in details. The password is shown once.'
            : 'The account is active immediately and tied to your school.'
        }
        size="md"
        footer={
          credentials ? (
            <button type="button" className="btn-primary" onClick={() => setModalOpen(false)}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" form="add-member-form" className="btn-primary" disabled={saving}>
                <Plus className="h-4 w-4" /> {saving ? 'Creating…' : 'Create account'}
              </button>
            </>
          )
        }
      >
        {credentials ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-jade-200 bg-jade-50/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-jade-800">Email</p>
              <p className="mt-0.5 break-all font-mono text-sm font-semibold text-ink-900">
                {credentials.email}
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-jade-800">
                Temporary password
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-jade-200 bg-white px-2.5 py-1.5 font-mono text-sm font-bold tracking-wider text-ink-900">
                  {credentials.password}
                </code>
                <IconButton
                  label="Copy credentials"
                  onClick={() =>
                    copy(`${credentials.email} / ${credentials.password}`, 'credentials')
                  }
                >
                  {copied === 'credentials' ? (
                    <Check className="h-4 w-4 text-jade-700" />
                  ) : (
                    <ClipboardCopy className="h-4 w-4" />
                  )}
                </IconButton>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-500">
              The {tab === 'students' ? 'student' : 'teacher'} can sign in from any device. Ask them to
              keep the password private.
            </p>
          </div>
        ) : (
          <form id="add-member-form" className="space-y-3" onSubmit={submitMember}>
            <div>
              <label className="label" htmlFor="member-name">
                Full name
              </label>
              <input
                id="member-name"
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={tab === 'students' ? 'e.g. Amaka Eze' : 'e.g. Mr. Okafor'}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="member-email">
                Email address
              </label>
              <input
                id="member-email"
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@school.edu.ng"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="member-class">
                  Class code
                </label>
                <input
                  id="member-class"
                  className="input"
                  value={form.classCode}
                  onChange={(event) => setForm({ ...form, classCode: event.target.value })}
                  placeholder={school.code ? `SS2A-${school.code.split('-')[0]}` : 'SS2A'}
                  required
                />
              </div>
              {tab === 'students' ? (
                <div>
                  <label className="label" htmlFor="member-grade">
                    Year group
                  </label>
                  <select
                    id="member-grade"
                    className="select"
                    value={form.gradeLevel}
                    onChange={(event) => setForm({ ...form, gradeLevel: event.target.value })}
                  >
                    <option value="SS1">SS1</option>
                    <option value="SS2">SS2</option>
                    <option value="SS3">SS3</option>
                  </select>
                </div>
              ) : null}
            </div>
            {formError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {formError}
              </p>
            ) : null}
          </form>
        )}
      </Modal>
    </div>
  );
}

