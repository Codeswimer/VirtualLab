import { useMemo, useState } from 'react';
import { GraduationCap, Info, Medal, School, Trophy, Users } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-app';
import { useAppStore } from '@/stores/app-store';
import {
  canViewOnScope,
  classOptionsFromLeaderboard,
  leaderboardForScope,
  rankFor,
  scopeHelpText,
  type LeaderboardScope,
} from '@/lib/leaderboard';
import { cn, initials } from '@/lib/utils';
import { Badge, EmptyState, ProgressBar, SectionHeading, Tabs } from '@/components/ui/primitives';
import {
  GradePill,
  PageHeading,
  PodiumCard,
  RankMedal,
} from '@/components/dashboard/kit';

export function LeaderboardPage() {
  const currentUser = useCurrentUser();
  const user = currentUser;
  const leaderboard = useAppStore((state) => state.leaderboard);
  const schools = useAppStore((state) => state.schools);

  const [scope, setScope] = useState<LeaderboardScope>('class');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedClassCode, setSelectedClassCode] = useState('');

  const role = user?.role ?? 'STUDENT';
  const isAdmin = role === 'ADMIN';
  const approvedSchools = schools
    .filter((school) => school.status === 'APPROVED')
    .sort((a, b) => a.name.localeCompare(b.name));

  const effectiveSchoolId =
    role === 'ADMIN'
      ? selectedSchoolId || approvedSchools[0]?.id || null
      : user?.schoolId ?? null;

  const options = useMemo(
    () => classOptionsFromLeaderboard(leaderboard, effectiveSchoolId),
    [leaderboard, effectiveSchoolId],
  );

  const ownClass =
    user && (user.role === 'STUDENT' || user.role === 'TEACHER') ? user.classCode : null;
  const classForScope =
    ownClass ??
    (options.some((option) => option.classCode === selectedClassCode)
      ? selectedClassCode
      : options[0]?.classCode ?? '');

  const board = useMemo(
    () => leaderboardForScope(leaderboard, scope, effectiveSchoolId, classForScope),
    [leaderboard, scope, effectiveSchoolId, classForScope],
  );

  const schoolName =
    schools.find((school) => school.id === effectiveSchoolId)?.name ?? 'Your school';
  const scopeLabel =
    scope === 'class'
      ? `${classForScope || 'Class'} · ${schoolName}`
      : scope === 'school'
        ? schoolName
        : 'All approved schools';

  const podium = board.slice(0, 3);
  const currentEntry = board.find((entry) => entry.studentId === user?.id);
  const classCount = board.length;

  const tabs = [
    {
      id: 'class',
      label: ownClass ? `My class · ${ownClass}` : 'Class',
      icon: <Users className="h-3.5 w-3.5" />,
    },
    { id: 'school', label: 'School', icon: <School className="h-3.5 w-3.5" /> },
    { id: 'global', label: 'Global', icon: <Trophy className="h-3.5 w-3.5" /> },
  ];

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeading
        eyebrow="Rankings"
        title="Leaderboards"
        subtitle="Class, school and national standings. Teacher marks count, and retakes use your best attempt per practical."
        actions={
          currentEntry ? (
            <Badge tone="jade">
              <Medal className="h-3 w-3" /> You are #{rankFor(currentEntry, scope)}{' '}
              {scope === 'global' ? 'nationally' : scope === 'school' ? 'in school' : 'in class'}
            </Badge>
          ) : user.role === 'STUDENT' ? (
            <Badge tone="neutral">
              <Info className="h-3 w-3" /> No ranked work in this scope
            </Badge>
          ) : (
            <Badge tone="neutral">
              <Users className="h-3 w-3" /> {board.length} students ranked
            </Badge>
          )
        }
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} value={scope} onChange={(id) => setScope(id as LeaderboardScope)} />
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && scope !== 'global' ? (
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              School
              <select
                className="select py-1.5 text-xs font-medium normal-case tracking-normal"
                value={effectiveSchoolId ?? ''}
                onChange={(event) => {
                  setSelectedSchoolId(event.target.value);
                  setSelectedClassCode('');
                }}
                aria-label="Select school"
              >
                {approvedSchools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {scope === 'class' && !ownClass ? (
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Class
              <select
                className="select py-1.5 text-xs font-medium normal-case tracking-normal"
                value={classForScope}
                onChange={(event) => setSelectedClassCode(event.target.value)}
                aria-label="Select class"
              >
                {options.map((option) => (
                  <option key={`${option.schoolId}-${option.classCode}`} value={option.classCode}>
                    {option.gradeLevel} · {option.classCode} ({option.size})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Badge tone="neutral">
            <GraduationCap className="h-3 w-3" /> {classCount} ranked
          </Badge>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-ink-100 bg-white/70 px-3 py-2 text-[11px] text-ink-500">        Showing <span className="font-semibold text-ink-700">{scopeLabel}</span>
        {user.role === 'STUDENT' && scope === 'class' ? ' · only your own class is visible to you' : ''}
        {!canViewOnScope(user.role, scope, effectiveSchoolId) && scope !== 'global' ? (
          <span className="ml-2 text-ink-400">· access restricted</span>
        ) : null}
      </div >

      {board.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={<Trophy className="h-6 w-6" />}
            title="No ranked students yet"
            body={
              scope === 'class'
                ? 'Once students in this class submit practicals, their best scores are averaged and ranked here.'
                : 'Approved schools appear once their students submit practicals.'
            }
          />
        </div>
      ) : (
        <>
          {podium.length > 0 ? (
            <section className="mt-5 grid gap-3 sm:grid-cols-3">
              {podium.map((entry) => (
                <PodiumCard
                  key={entry.studentId}
                  highlight={entry.studentId === user.id}
                  entry={{
                    rank: rankFor(entry, scope),
                    name: entry.name,
                    initials: initials(entry.name),
                    average: entry.average,
                    grade: entry.grade,
                    subtitle:
                      scope === 'global'
                        ? entry.schoolName
                        : scope === 'school'
                          ? entry.classCode
                          : entry.gradeLevel,
                  }}
                />
              ))}
            </section>
          ) : null}

          <section className="card mt-5 p-5">
            <SectionHeading
              title="Full standings"
              subtitle="Average of each student’s best score in every practical attempted."
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="w-12 py-2 pr-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">#</th>
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Student</th>
                    {scope !== 'class' ? (
                      <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Class</th>
                    ) : null}
                    {scope === 'global' ? (
                      <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">School</th>
                    ) : null}
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Modules</th>
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Average</th>
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((entry) => {
                    const isMe = entry.studentId === user.id;
                    return (
                      <tr
                        key={entry.studentId}
                        className={cn(
                          'border-b border-ink-50 last:border-0',
                          isMe && 'bg-jade-50/50',
                        )}
                      >
                        <td className="py-2.5 pr-2">
                          <RankMedal rank={rankFor(entry, scope)} />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[9px] font-bold',
                                isMe ? 'bg-jade-700 text-white' : 'bg-ink-100 text-ink-700',
                              )}
                            >
                              {initials(entry.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-ink-800">
                                {entry.name}
                                {isMe ? (
                                  <span className="text-[9px] font-medium text-jade-700">you</span>
                                ) : null}
                              </p>
                              <p className="text-[9.5px] text-ink-400">
                                {entry.gradeLevel} · {entry.submissions} submission
                                {entry.submissions === 1 ? '' : 's'}
                              </p>
                            </div>
                          </div>
                        </td>
                        {scope !== 'class' ? (
                          <td className="px-2 py-2.5 font-mono text-[10px] text-ink-600">
                            {entry.classCode}
                          </td>
                        ) : null}
                        {scope === 'global' ? (
                          <td className="px-2 py-2.5">
                            <p className="max-w-[160px] truncate text-[10.5px] text-ink-600">
                              {entry.schoolName}
                            </p>
                          </td>
                        ) : null}
                        <td className="px-2 py-2.5 font-mono text-[10px] text-ink-500">
                          {entry.modules}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <ProgressBar
                              className="w-16"
                              value={entry.average}
                              tone={entry.average >= 70 ? 'jade' : entry.average >= 50 ? 'amber' : 'red'}
                            />
                            <span className="font-mono text-[11px] font-semibold text-ink-700">
                              {entry.average.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <GradePill grade={entry.grade} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Ranking method: for each practical, only a student’s best attempt is counted. Those best
        scores are averaged and converted to the WAEC A1–F9 grade scale. A teacher’s manual mark
        replaces the automatic rubric score. Revoked accounts and unapproved schools are excluded.
      </p>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        {scopeHelpText(scope, user.role, effectiveSchoolId)}
      </p>
    </div>
  );
}
