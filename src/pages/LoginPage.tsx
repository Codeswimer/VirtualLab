import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FlaskConical,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
} from 'lucide-react';
import { useAppStore, type Role } from '@/stores/app-store';
import { useCurrentUser } from '@/hooks/use-app';
import { Tabs } from '@/components/ui/primitives';

type Mode = 'signin' | 'signup' | 'school';

interface Notice {
  title: string;
  body: string;
  tone: 'jade' | 'amber';
}

const demoButtons: {
  role: Role;
  title: string;
  subtitle: string;
  icon: typeof GraduationCap;
  tone: string;
}[] = [
  {
    role: 'STUDENT',
    title: 'Demo student',
    subtitle: 'Ada Obi · SS2A',
    icon: GraduationCap,
    tone: 'bg-jade-100 text-jade-800',
  },
  {
    role: 'TEACHER',
    title: 'Demo teacher',
    subtitle: 'Mr. Bello · SS2A',
    icon: FlaskConical,
    tone: 'bg-amber-100 text-amber-800',
  },
  {
    role: 'SCHOOL_ADMIN',
    title: 'Demo school admin',
    subtitle: "Mrs. Adeyemi · King's",
    icon: Users,
    tone: 'bg-sky-100 text-sky-800',
  },
  {
    role: 'ADMIN',
    title: 'Demo owner',
    subtitle: 'Dr. Eze · Platform',
    icon: ShieldCheck,
    tone: 'bg-ink-900 text-white',
  },
];

export function LoginPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAppStore((state) => state.signIn);
  const signUp = useAppStore((state) => state.signUp);
  const registerSchool = useAppStore((state) => state.registerSchool);
  const signInDemo = useAppStore((state) => state.signInDemo);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [schoolCode, setSchoolCode] = useState('');
  const [classCode, setClassCode] = useState('');
  const [gradeLevel, setGradeLevel] = useState('SS2');
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    contactName: '',
    contactEmail: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signUp({
      name,
      email,
      password,
      role,
      schoolCode,
      classCode,
      gradeLevel,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice({
      title: 'Request sent to your school',
      tone: 'jade',
      body: `Your ${role === 'STUDENT' ? 'student' : 'teacher'} account is waiting for your school administrator to approve it. Sign in once it is approved.`,
    });
    setMode('signin');
    setPassword('');
  };

  const handleRegisterSchool = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await registerSchool(schoolForm);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice({
      title: 'School application submitted',
      tone: 'amber',
      body: 'The platform owner reviews every school before it can onboard students. You will be able to sign in with the contact email once approved.',
    });
    setMode('signin');
    setEmail(schoolForm.contactEmail);
    setPassword('');
    setSchoolForm({
      name: '',
      code: '',
      city: '',
      state: '',
      contactName: '',
      contactEmail: '',
      password: '',
    });
  };

  const joinCodeHint = mode === 'signup' ? 'Provided by your school admin' : '';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="bench-dark relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-jade-600 text-white">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Virtual Lab</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-jade-300">
              Nigeria
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-auto max-w-lg">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-jade-400/30 bg-jade-400/10 px-3 py-1 text-[11px] font-semibold text-jade-200">
            <Sparkles className="h-3.5 w-3.5" />
            Built for WAEC, NECO and the NERDC syllabus
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight">
            One laboratory.
            <br />
            Four dashboards.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-200/80">
            Students practise real practicals, teachers mark the work, schools manage access and the
            platform owner approves every school — with class, school and national leaderboards.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-ink-100/85">
            {[
              '23 guided practicals across SS1–SS3 physics and chemistry',
              'Automatic marking plus a teacher’s examiner mark',
              'Class, school and global leaderboards',
              'Works offline after the first load',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-jade-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 mt-10 flex flex-wrap items-center gap-3 text-[11px] text-ink-300/80">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-jade-400" /> Role-based access
          </span>
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5 text-amber-300" /> Offline-ready
          </span>
        </div>

        <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-jade-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <ApparatusIllustration />
      </section>

      <section className="flex min-h-screen flex-col justify-center bg-paper px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-jade-700 text-white">
              <FlaskConical className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Virtual Lab Nigeria</p>
              <p className="text-[11px] text-ink-500">Physics & Chemistry practicals</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            {mode === 'signin'
              ? 'Welcome back'
              : mode === 'signup'
                ? 'Request a lab account'
                : 'Register your school'}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {mode === 'signin'
              ? 'Sign in to your dashboard.'
              : mode === 'signup'
                ? 'Your school administrator approves every new account.'
                : 'Applications are reviewed by the platform owner before activation.'}
          </p>

          <div className="mt-5">
            <Tabs
              tabs={[
                { id: 'signin', label: 'Sign in' },
                { id: 'signup', label: 'Create account' },
                { id: 'school', label: 'Register school' },
              ]}
              value={mode}
              onChange={(id) => switchMode(id as Mode)}
            />
          </div>

          {notice ? (
            <div
              className={
                notice.tone === 'jade'
                  ? 'mt-5 rounded-xl border border-jade-200 bg-jade-50 px-3.5 py-3'
                  : 'mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3'
              }
            >
              <p className="flex items-center gap-1.5 text-xs font-bold text-ink-900">
                {notice.tone === 'jade' ? (
                  <CheckCircle2 className="h-4 w-4 text-jade-700" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-700" />
                )}
                {notice.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-600">{notice.body}</p>
            </div>
          ) : null}

          {mode === 'signin' ? (
            <form className="mt-5 space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="label" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu.ng"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                Sign in <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : null}

          {mode === 'signup' ? (
            <form className="mt-5 space-y-4" onSubmit={handleSignUp}>
              <div>
                <label className="label" htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Chiamaka Nwosu"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <span className="label">I am a</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['STUDENT', 'TEACHER'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRole(option)}
                      className={
                        role === option
                          ? 'flex items-center gap-2 rounded-xl border-2 border-jade-600 bg-jade-50 px-3 py-2.5 text-sm font-semibold text-jade-900'
                          : 'flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium text-ink-600 hover:border-ink-300'
                      }
                    >
                      {option === 'STUDENT' ? (
                        <GraduationCap className="h-4 w-4" />
                      ) : (
                        <FlaskConical className="h-4 w-4" />
                      )}
                      {option === 'STUDENT' ? 'Student' : 'Teacher'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="signup-email">
                  Email address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu.ng"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="signup-password">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="school-code">
                    School join code
                  </label>
                  <input
                    id="school-code"
                    className="input font-mono uppercase"
                    value={schoolCode}
                    onChange={(event) => setSchoolCode(event.target.value)}
                    placeholder="KCL-LAG"
                    required
                  />
                  <p className="field-hint">{joinCodeHint}</p>
                </div>
                <div>
                  <label className="label" htmlFor="class-code">
                    Class code
                  </label>
                  <input
                    id="class-code"
                    className="input font-mono uppercase"
                    value={classCode}
                    onChange={(event) => setClassCode(event.target.value)}
                    placeholder="SS2A-KCL"
                    required
                  />
                </div>
              </div>
              {role === 'STUDENT' ? (
                <div>
                  <label className="label" htmlFor="grade-level">
                    Year group
                  </label>
                  <select
                    id="grade-level"
                    className="select"
                    value={gradeLevel}
                    onChange={(event) => setGradeLevel(event.target.value)}
                  >
                    <option value="SS1">SS1</option>
                    <option value="SS2">SS2</option>
                    <option value="SS3">SS3</option>
                  </select>
                </div>
              ) : null}
              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                Send request <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : null}

          {mode === 'school' ? (
            <form className="mt-5 space-y-3.5" onSubmit={handleRegisterSchool}>
              <div>
                <label className="label" htmlFor="school-name">
                  School name
                </label>
                <input
                  id="school-name"
                  className="input"
                  value={schoolForm.name}
                  onChange={(event) => setSchoolForm({ ...schoolForm, name: event.target.value })}
                  placeholder="e.g. Unity Secondary School"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="school-join-code">
                    Join code
                  </label>
                  <input
                    id="school-join-code"
                    className="input font-mono uppercase"
                    value={schoolForm.code}
                    onChange={(event) =>
                      setSchoolForm({ ...schoolForm, code: event.target.value.toUpperCase() })
                    }
                    placeholder="UNITY-LAG"
                    required
                  />
                  <p className="field-hint">4–12 letters, numbers or dashes.</p>
                </div>
                <div>
                  <label className="label" htmlFor="school-contact">
                    Admin name
                  </label>
                  <input
                    id="school-contact"
                    className="input"
                    value={schoolForm.contactName}
                    onChange={(event) =>
                      setSchoolForm({ ...schoolForm, contactName: event.target.value })
                    }
                    placeholder="e.g. Mrs. Bisi Oladipo"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="school-city">
                    City
                  </label>
                  <input
                    id="school-city"
                    className="input"
                    value={schoolForm.city}
                    onChange={(event) => setSchoolForm({ ...schoolForm, city: event.target.value })}
                    placeholder="Ibadan"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="school-state">
                    State
                  </label>
                  <input
                    id="school-state"
                    className="input"
                    value={schoolForm.state}
                    onChange={(event) => setSchoolForm({ ...schoolForm, state: event.target.value })}
                    placeholder="Oyo"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="school-email">
                  Contact email
                </label>
                <input
                  id="school-email"
                  type="email"
                  className="input"
                  value={schoolForm.contactEmail}
                  onChange={(event) =>
                    setSchoolForm({ ...schoolForm, contactEmail: event.target.value })
                  }
                  placeholder="admin@school.edu.ng"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="school-password">
                  Admin password
                </label>
                <input
                  id="school-password"
                  type="password"
                  className="input"
                  value={schoolForm.password}
                  onChange={(event) =>
                    setSchoolForm({ ...schoolForm, password: event.target.value })
                  }
                  placeholder="At least 6 characters"
                  required
                />
              </div>
              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                <Building2 className="h-4 w-4" /> Submit application
              </button>
            </form>
          ) : null}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-100" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              or open a demo dashboard
            </span>
            <span className="h-px flex-1 bg-ink-100" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {demoButtons.map((demo) => (
              <button
                key={demo.role}
                type="button"
                className="btn-secondary justify-start px-2.5 py-2.5 text-left"
                onClick={() => {
                  setError(null);
                  void signInDemo(demo.role).then((message) => {
                    if (message) setError(message);
                  });
                }}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${demo.tone}`}
                >
                  <demo.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-ink-800">
                    {demo.title}
                  </span>
                  <span className="block truncate text-[9.5px] font-normal text-ink-500">
                    {demo.subtitle}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <p className="mt-5 text-center text-[10px] leading-relaxed text-ink-400">
            Demo accounts are seeded on this lab server. This project is not affiliated with NERDC,
            WAEC, NECO or JAMB.
          </p>
        </div>
      </section>
    </div>
  );
}

function ApparatusIllustration() {
  return (
    <svg
      viewBox="0 0 320 320"
      className="pointer-events-none absolute -bottom-8 right-2 h-[300px] w-[300px] opacity-70"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#45bd88" stopOpacity="0.9" />
          <stop offset="1" stopColor="#106849" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <g stroke="#9fe3c4" strokeOpacity="0.5" fill="none" strokeWidth="2">
        <path d="M92 250 L92 120 L80 100 L128 100 L116 120 L116 250 Q104 266 92 250Z" fill="url(#glass)" />
        <path d="M96 190 L96 248 Q104 258 112 248 L112 190Z" fill="url(#liquid)" stroke="none" />
        <path d="M190 250 L190 140 L178 122 L226 122 L214 140 L214 250 Q202 264 190 250Z" fill="url(#glass)" />
        <path d="M194 205 L194 248 Q202 256 210 248 L210 205Z" fill="#e3a532" fillOpacity="0.7" stroke="none" />
        <path d="M56 262 L248 262" strokeOpacity="0.35" />
        <circle cx="202" cy="86" r="5" fill="#e3a532" stroke="none" />
        <circle cx="220" cy="64" r="3.5" fill="#45bd88" stroke="none" />
        <circle cx="182" cy="58" r="2.5" fill="#ffffff" stroke="none" fillOpacity="0.5" />
      </g>
    </svg>
  );
}
