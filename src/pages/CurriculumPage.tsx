import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Info, Layers } from 'lucide-react';
import { EXPERIMENTS, PRIORITY_LABELS, SUBJECT_LABELS } from '@/experiments';
import type { Priority, Subject } from '@/experiments/types';
import { Badge, SectionHeading, Tabs } from '@/components/ui/primitives';

const priorities: Priority[] = ['P0', 'P1', 'P2'];

export function CurriculumPage() {
  const [subject, setSubject] = useState<Subject>('PHYSICS');
  const modules = EXPERIMENTS.filter((experiment) => experiment.meta.subject === subject);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-jade-700">Curriculum</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
        Practical coverage, mapped to the syllabus
      </h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
        Every module names the senior-secondary topic it practises, so a teacher can match a lesson
        to a simulation. Priorities follow the specification: exam-critical first, then core, then
        extension.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="jade">
          <Layers className="h-3 w-3" /> {EXPERIMENTS.length} modules across both sciences
        </Badge>
        <Badge tone="neutral">SS1–SS3</Badge>
        <Badge tone="amber">WAEC · NECO · JAMB</Badge>
      </div>

      <div className="mt-5">
        <Tabs
          tabs={[
            { id: 'PHYSICS', label: `Physics (${EXPERIMENTS.filter((e) => e.meta.subject === 'PHYSICS').length})` },
            { id: 'CHEMISTRY', label: `Chemistry (${EXPERIMENTS.filter((e) => e.meta.subject === 'CHEMISTRY').length})` },
          ]}
          value={subject}
          onChange={(id) => setSubject(id as Subject)}
        />
      </div>

      <div className="mt-5 space-y-6">
        {priorities.map((priority) => {
          const group = modules.filter((experiment) => experiment.meta.priority === priority);
          if (group.length === 0) return null;
          return (
            <section key={priority}>
              <SectionHeading
                title={`${PRIORITY_LABELS[priority]} · ${SUBJECT_LABELS[subject]}`}
                subtitle={
                  priority === 'P0'
                    ? 'Practise these until they are automatic.'
                    : priority === 'P1'
                      ? 'Core practical skills expected in most papers.'
                      : 'Extension work for wider understanding.'
                }
              />
              <div className="mt-3 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
                {group.map((experiment, index) => (
                  <div
                    key={experiment.meta.code}
                    className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 ${
                      index !== 0 ? 'border-t border-ink-50' : ''
                    }`}
                  >
                    <div className="flex w-full items-start gap-3 sm:w-24">
                      <span className="font-mono text-[10px] font-bold text-ink-400">
                        {experiment.meta.code}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/lab/${experiment.meta.slug}`}
                        className="text-sm font-semibold text-ink-900 hover:text-jade-800"
                      >
                        {experiment.meta.title}
                      </Link>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
                        {experiment.meta.curriculum}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {experiment.meta.skills.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className="rounded bg-ink-50 px-1.5 py-0.5 text-[9.5px] font-medium text-ink-500"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link
                      to={`/lab/${experiment.meta.slug}`}
                      className="btn-secondary btn-sm shrink-0 self-start sm:self-center"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <Info className="h-4 w-4" /> About the alignment
        </h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-amber-950/80">
          This project is not affiliated with or endorsed by NERDC, WAEC, NECO or JAMB. “Aligned”
          means designed with reference to publicly available syllabi; the mapping must be validated
          by a qualified curriculum reviewer before classroom use as an official resource.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-900/80">
          <BookOpenCheck className="h-3.5 w-3.5" /> Simulations support rehearsal; they do not replace
          hands-on practicals in formal examinations.
        </p>
      </div>
    </div>
  );
}
