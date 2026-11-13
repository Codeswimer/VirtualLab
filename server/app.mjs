import {
  gradeFor,
  makeId,
  now,
} from './db.mjs';
import {
  hashPassword,
  makeTemporaryPassword,
  makeToken,
  sha256,
  verifyPassword,
} from './security.mjs';

const DEMO_STREAMS = new Map([
  ['ada@vlab.ng', 'demo-student'],
  ['bello@vlab.ng', 'demo-teacher'],
  ['admin@kingscollege.edu.ng', 'demo-school-admin'],
  ['chidi@vlab.ng', 'chidi-vlab'],
  ['ngozi@vlab.ng', 'gfa-pending-student'],
]);

const DEMO_TOKEN_HASH = 'fa3ed63aff12060fe06aba45ff26b82513f89d814f7708f15134520ef';

function ensureDemoSession(db, accountId) {
  if (db.prepare('SELECT 1 FROM sessions WHERE token_hash = ?').get(DEMO_TOKEN_HASH)) return;
  db.prepare(
    'INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(DEMO_TOKEN_HASH, accountId, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z');
}

function demoTokenFor(email) {
  if (!DEMO_STREAMS.has(email)) return null;
  return DEMO_TOKEN_HASH;
}

function demoAccountIdFor(email) {
  return DEMO_STREAMS.get(email) ?? null;
}

const ACCOUNT_SELECT = `
  SELECT a.id, a.name, a.email, a.role, a.school_id, a.class_code, a.grade_level,
         a.status, a.created_at, a.password_hash,
         COALESCE(s.name, 'Virtual Lab Nigeria') AS school_name
  FROM accounts a
  LEFT JOIN schools s ON s.id = a.school_id
`;

const SESSION_DAYS = 30;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) throw new HttpError(413, 'That request is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not-an-object');
    }
    return parsed;
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function required(value, label, max = 200) {
  const cleaned = text(value, max);
  if (!cleaned) throw new HttpError(400, `${label} is required.`);
  return cleaned;
}

function normaliseEmail(value) {
  return text(value, 160).toLowerCase();
}

function mapSchool(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    city: row.city,
    state: row.state,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? undefined,
  };
}

function mapAccount(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    schoolId: row.school_id,
    school: row.school_name,
    classCode: row.class_code,
    gradeLevel: row.grade_level,
    status: row.status,
    createdAt: row.created_at,
  };
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapAttempt(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    experimentCode: row.experiment_code,
    seed: Number(row.seed),
    status: row.status,
    delivery: row.delivery,
    configVersion: Number(row.config_version),
    idempotencyKey: row.idempotency_key,
    startedAt: row.started_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    rows: parseJson(row.rows_json, []),
    answers: parseJson(row.answers_json, {}),
    graph: parseJson(row.graph_json, null),
    flags: parseJson(row.flags_json, {}),
    notes: row.notes ?? '',
    score: parseJson(row.score_json, undefined),
    review: parseJson(row.review_json, undefined),
    scenarioSnapshot: parseJson(row.scenario_json, undefined),
    params: parseJson(row.params_json, {}),
    assignmentId: row.assignment_id ?? undefined,
    challenge: parseJson(row.challenge_json, {}),
  };
}

const ASSIGNMENT_SELECT = `
  SELECT asg.*, a.name AS teacher_name
  FROM assignments asg
  JOIN accounts a ON a.id = asg.teacher_id
`;

function mapAssignment(row, redactGuides = false) {
  const questions = parseJson(row.questions_json, []);
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name ?? 'Teacher',
    schoolId: row.school_id,
    classCode: row.class_code,
    title: row.title,
    experimentCode: row.experiment_code,
    instructions: row.instructions ?? '',
    dueAt: row.due_at ?? undefined,
    params: parseJson(row.params_json, {}),
    // Students receive the questions but never the examiner's marking guide.
    questions: redactGuides
      ? questions.map((question) => ({ ...question, markingGuide: '' }))
      : questions,
    markingGuide: redactGuides ? '' : (row.marking_guide ?? ''),
    source: row.source ?? 'TEACHER',
    createdAt: row.created_at,
  };
}

function numberMap(value, limit = 24) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value).slice(0, limit)) {
    const numeric = typeof raw === 'string' ? Number(raw) : raw;
    if (!key || typeof numeric !== 'number' || !Number.isFinite(numeric)) continue;
    result[key.slice(0, 40)] = numeric;
  }
  return result;
}

function cleanQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 8)
    .map((entry, index) => {
      const marks = Number(entry?.marks);
      return {
        id: text(entry?.id, 40) || `q${index + 1}`,
        prompt: text(entry?.prompt, 600),
        marks: Number.isFinite(marks) ? Math.min(10, Math.max(1, Math.round(marks))) : 1,
        markingGuide: text(entry?.markingGuide, 1200),
      };
    })
    .filter((entry) => entry.prompt);
}

function getSchool(db, id) {
  return db.prepare('SELECT * FROM schools WHERE id = ?').get(id);
}

function getAccountById(db, id) {
  return db.prepare(`${ACCOUNT_SELECT} WHERE a.id = ?`).get(id);
}

function getAttempt(db, id) {
  return db.prepare('SELECT * FROM attempts WHERE id = ?').get(id);
}

function sessionLogin(db, accountId) {
  const token = makeToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.prepare(
    'INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(sha256(token), accountId, createdAt, expiresAt);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(createdAt);
  return token;
}

function actorFromSession(db, token) {
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  const row = db
    .prepare(
      `${ACCOUNT_SELECT}
       JOIN sessions sess ON sess.account_id = a.id
       WHERE sess.token_hash = ? AND sess.expires_at > ?`,
    )
    .get(sha256(token), Date.now());
  if (!row) throw new HttpError(401, 'Your session has expired. Sign in again.');
  if (row.status === 'REVOKED') {
    throw new HttpError(403, 'Access to this account has been revoked.');
  }
  if (row.role !== 'ADMIN') {
    const school = row.school_id ? getSchool(db, row.school_id) : null;
    if (!school) throw new HttpError(403, 'Your school record could not be found.');
    if (school.status === 'PENDING') {
      throw new HttpError(403, 'Your school is still awaiting platform approval.');
    }
    if (school.status === 'REVOKED') {
      throw new HttpError(403, 'Your school’s access has been revoked by the platform owner.');
    }
  }
  if (row.status === 'PENDING') {
    throw new HttpError(403, 'Your account is waiting for your school administrator to approve it.');
  }
  return mapAccount(row);
}

function actorFromRequest(req, db) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  return actorFromSession(db, token);
}

function requireActor(actor) {
  if (!actor) throw new HttpError(401, 'Sign in to continue.');
  return actor;
}

function assertRole(actor, roles) {
  if (!actor || !roles.includes(actor.role)) throw new HttpError(403, 'You do not have access to this action.');
}

function accountRowsFor(db, actor) {
  if (actor.role === 'ADMIN') {
    return db.prepare(`${ACCOUNT_SELECT} ORDER BY a.created_at DESC`).all();
  }
  if (actor.role === 'SCHOOL_ADMIN') {
    return db
      .prepare(`${ACCOUNT_SELECT} WHERE a.school_id = ? ORDER BY a.created_at DESC`)
      .all(actor.schoolId);
  }
  if (actor.role === 'TEACHER') {
    return db
      .prepare(
        `${ACCOUNT_SELECT}
         WHERE a.id = ? OR (a.school_id = ? AND a.class_code = ? AND a.role = 'STUDENT')
         ORDER BY a.name COLLATE NOCASE`,
      )
      .all(actor.id, actor.schoolId, actor.classCode);
  }
  return db.prepare(`${ACCOUNT_SELECT} WHERE a.id = ?`).all(actor.id);
}

function assignmentRowsFor(db, actor) {
  if (actor.role === 'ADMIN') {
    return db.prepare(`${ASSIGNMENT_SELECT} ORDER BY asg.created_at DESC`).all();
  }
  if (actor.role === 'SCHOOL_ADMIN') {
    return db
      .prepare(`${ASSIGNMENT_SELECT} WHERE asg.school_id = ? ORDER BY asg.created_at DESC`)
      .all(actor.schoolId);
  }
  return db
    .prepare(
      `${ASSIGNMENT_SELECT}
       WHERE asg.school_id = ? AND asg.class_code = ?
       ORDER BY asg.created_at DESC`,
    )
    .all(actor.schoolId, actor.classCode);
}

function attemptRowsFor(db, actor) {
  if (actor.role === 'ADMIN') {
    return db.prepare('SELECT * FROM attempts ORDER BY COALESCE(submitted_at, started_at) DESC').all();
  }
  if (actor.role === 'SCHOOL_ADMIN') {
    return db
      .prepare(
        `SELECT * FROM attempts
         WHERE student_id IN (SELECT id FROM accounts WHERE school_id = ?)
         ORDER BY COALESCE(submitted_at, started_at) DESC`,
      )
      .all(actor.schoolId);
  }
  if (actor.role === 'TEACHER') {
    return db
      .prepare(
        `SELECT * FROM attempts
         WHERE student_id IN (
           SELECT id FROM accounts WHERE school_id = ? AND class_code = ? AND role = 'STUDENT'
         )
         ORDER BY COALESCE(submitted_at, started_at) DESC`,
      )
      .all(actor.schoolId, actor.classCode);
  }
  return db
    .prepare('SELECT * FROM attempts WHERE student_id = ? ORDER BY started_at DESC')
    .all(actor.id);
}

function attemptPercent(score, review) {
  if (!score) return null;
  if (review && Number.isFinite(Number(review.marks)) && Number(score.max) > 0) {
    return Math.round((Number(review.marks) / Number(score.max)) * 1000) / 10;
  }
  return Number(score.percent) || 0;
}

function assignRanks(rows, field, keyFor) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        b.average - a.average ||
        b.submissions - a.submissions ||
        a.name.localeCompare(b.name),
    );
    let previousAverage = null;
    let previousRank = 0;
    group.forEach((row, index) => {
      row[field] = row.average === previousAverage ? previousRank : index + 1;
      previousAverage = row.average;
      previousRank = row[field];
    });
  }
}

function buildLeaderboardRows(db) {
  const students = db
    .prepare(
      `SELECT a.id, a.name, a.school_id, a.class_code, a.grade_level,
              s.name AS school_name
       FROM accounts a
       JOIN schools s ON s.id = a.school_id
       WHERE a.role = 'STUDENT' AND a.status = 'ACTIVE' AND s.status = 'APPROVED'`,
    )
    .all();
  const studentById = new Map(students.map((student) => [student.id, student]));
  const attempts = db
    .prepare('SELECT student_id, experiment_code, score_json, review_json FROM attempts WHERE status = ?')
    .all('SCORED');

  const metrics = new Map();
  for (const attempt of attempts) {
    if (!studentById.has(attempt.student_id)) continue;
    const score = parseJson(attempt.score_json, null);
    const review = parseJson(attempt.review_json, null);
    const percent = attemptPercent(score, review);
    if (percent === null) continue;
    const entry =
      metrics.get(attempt.student_id) ??
      { best: new Map(), submissions: 0, reviewed: 0 };
    const current = entry.best.get(attempt.experiment_code);
    if (current === undefined || percent > current) {
      entry.best.set(attempt.experiment_code, percent);
    }
    entry.submissions += 1;
    if (review) entry.reviewed += 1;
    metrics.set(attempt.student_id, entry);
  }

  const rows = [];
  for (const student of students) {
    const entry = metrics.get(student.id);
    if (!entry || entry.best.size === 0) continue;
    const values = [...entry.best.values()];
    const average =
      Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
    rows.push({
      studentId: student.id,
      name: student.name,
      schoolId: student.school_id,
      schoolName: student.school_name,
      classCode: student.class_code,
      gradeLevel: student.grade_level,
      average,
      best: Math.max(...values),
      modules: entry.best.size,
      submissions: entry.submissions,
      reviewed: entry.reviewed,
      grade: gradeFor(average),
      classRank: 0,
      schoolRank: 0,
      globalRank: 0,
    });
  }

  assignRanks(rows, 'globalRank', () => 'global');
  assignRanks(rows, 'schoolRank', (row) => row.schoolId);
  assignRanks(rows, 'classRank', (row) => `${row.schoolId}:${row.classCode}`);
  rows.sort((a, b) => a.globalRank - b.globalRank || a.name.localeCompare(b.name));
  return rows;
}

function bootstrap(db, actor) {
  const schools =
    actor.role === 'ADMIN'
      ? db.prepare('SELECT * FROM schools ORDER BY created_at DESC').all()
      : [getSchool(db, actor.schoolId)].filter(Boolean);
  return {
    user: actor,
    schools: schools.map(mapSchool),
    accounts: accountRowsFor(db, actor).map(mapAccount),
    attempts: attemptRowsFor(db, actor).map(mapAttempt),
    assignments: assignmentRowsFor(db, actor).map((row) =>
      mapAssignment(row, actor.role === 'STUDENT'),
    ),
    leaderboard: buildLeaderboardRows(db),
    serverTime: now(),
  };
}

function loginBodyProblem(row, db) {
  if (row.status === 'REVOKED') {
    return 'Access to this account has been revoked. Contact your school administrator.';
  }
  if (row.role !== 'ADMIN') {
    const school = row.school_id ? getSchool(db, row.school_id) : null;
    if (!school) return 'Your school record could not be found. Contact the platform owner.';
    if (school.status === 'PENDING') {
      return 'Your school is still awaiting platform approval. Try again shortly.';
    }
    if (school.status === 'REVOKED') {
      return 'Your school’s access has been revoked by the platform owner.';
    }
  }
  if (row.status === 'PENDING') {
    return row.role === 'SCHOOL_ADMIN'
      ? 'Your school application is still being reviewed by the platform owner.'
      : 'Your account is waiting for your school administrator to approve it.';
  }
  return null;
}

function canReview(actor, attempt, student) {
  if (!attempt || !student) return false;
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'TEACHER') return false;
  return student.school_id === actor.schoolId && student.class_code === actor.classCode;
}

function validateMarks(score, marks) {
  const max = Number(score?.max);
  const value = Number(marks);
  if (!score || !Number.isFinite(max) || max <= 0) {
    throw new HttpError(409, 'This submission has not been auto-marked yet.');
  }
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new HttpError(400, `Enter marks between 0 and ${max}.`);
  }
  return Math.round(value * 2) / 2;
}

function applyAttemptPayloadDefaults(body) {
  return {
    configVersion: Number.isFinite(Number(body.configVersion)) ? Number(body.configVersion) : 1,
    idempotencyKey: text(body.idempotencyKey, 120) || makeId('idem'),
    startedAt: text(body.startedAt, 60) || now(),
    rows: Array.isArray(body.rows) ? body.rows : [],
    answers: body.answers && typeof body.answers === 'object' ? body.answers : {},
    graph: body.graph ?? null,
    flags: body.flags && typeof body.flags === 'object' ? body.flags : {},
    notes: text(body.notes, 12000),
  };
}

/** Preferred model first, then a lighter fallback for demand spikes. */
const aiModels = () => {
  const configured = (process.env.GEMINI_MODEL ?? '').trim();
  return [...new Set([configured || 'gemini-3.1-flash-lite', 'gemini-3.6-flash'])];
};

function coerceChallenge(payload, questionCount) {
  const title = text(payload?.title, 140);
  const objective = text(payload?.objective, 500);
  const instructions = text(payload?.instructions, 1200);
  const waecReference = text(payload?.waecReference, 160);
  const markingGuide = text(payload?.markingGuide, 2000);
  const questions = cleanQuestions(payload?.questions)
    .slice(0, Math.max(2, Math.min(6, questionCount)))
    .map((entry, index) => ({ ...entry, id: `q${index + 1}` }));
  if (!title || questions.length < 2) {
    throw new HttpError(502, 'The AI returned an incomplete challenge. Try generating again.');
  }
  return {
    title,
    waecReference: waecReference || 'WAEC practical syllabus',
    objective,
    instructions,
    questions,
    markingGuide,
  };
}

async function generateAiChallenge(input) {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new HttpError(
      503,
      'The AI challenge generator is not configured. Add GEMINI_API_KEY to the server environment.',
    );
  }

  const subject = input.subject === 'CHEMISTRY' ? 'Chemistry' : 'Physics';
  const gradeLevel = text(input.gradeLevel, 12) || 'SS2';
  const difficulty = ['foundation', 'standard', 'extension'].includes(input.difficulty)
    ? input.difficulty
    : 'standard';
  const questionCount = Math.max(2, Math.min(6, Number(input.count) || 4));
  const focus = text(input.focus, 300);
  const experimentCode = text(input.experimentCode, 20);
  const experimentTitle = text(input.experimentTitle, 160);
  const curriculum = text(input.curriculum, 300);
  const skills = Array.isArray(input.skills)
    ? input.skills.filter((skill) => typeof skill === 'string').slice(0, 8).map((skill) => text(skill, 80))
    : [];

  const moduleContext = experimentCode
    ? `The students will carry out this virtual practical: ${experimentCode} — ${experimentTitle}.
Curriculum link: ${curriculum || 'WAEC senior secondary practical syllabus'}.
Skills practised: ${skills.join('; ') || 'practical measurement, data handling and inference'}.
Write the challenge so it can be completed using that apparatus and those measurements.`
    : 'Design a written challenge tied to the WAEC practical syllabus for this subject.';

  const prompt = `Create one new WAEC-style practical challenge for a Nigerian senior secondary school class.

Subject: ${subject}
Class: ${gradeLevel}
Difficulty: ${difficulty}
${focus ? `Teacher focus: ${focus}\n` : ''}${moduleContext}

Ground every task in the WAEC/NECO practical curriculum. Use British English, SI units and the conventions of a Nigerian practical paper (readings, precautions, calculation, sources of error). The written questions must be answerable from the practical and its theory; do not invent apparatus the simulation does not have. Do not repeat an existing textbook question verbatim.

Return JSON only, with exactly this shape:
{
  "title": "short challenge title",
  "waecReference": "topic and paper reference, e.g. SS2 mechanics — WAEC practical paper 3",
  "objective": "what the student will determine or demonstrate",
  "instructions": "3–5 sentences telling the student what to do on the bench and what to submit",
  "questions": [
    { "prompt": "question text", "marks": 2, "markingGuide": "what earns full marks" }
  ],
  "markingGuide": "general examiner guidance for the whole challenge"
}

Rules: give exactly ${questionCount} questions; each question is worth 2–6 marks; the markingGuide must be specific enough for a teacher to award partial credit; no markdown, no code fences, no extra keys.`;

  let response = null;
  let model = '';
  let lastStatus = 0;
  for (const candidate of aiModels()) {
    let attempt = null;
    try {
      attempt = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.9,
              responseMimeType: 'application/json',
              maxOutputTokens: 2048,
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
    } catch (error) {
      console.error(`Gemini request to ${candidate} failed:`, error.message);
      continue;
    }
    if (attempt.ok) {
      response = attempt;
      model = candidate;
      break;
    }
    lastStatus = attempt.status;
    const detail = await attempt.text().catch(() => '');
    console.error(`Gemini ${candidate} responded ${attempt.status}:`, detail.slice(0, 300));
    // 404 (retired model), 429 and 503 (demand) are worth trying on the fallback.
    if (![404, 429, 503].includes(attempt.status)) break;
  }

  if (!response) {
    throw new HttpError(
      lastStatus === 429 ? 429 : 503,
      lastStatus === 429
        ? 'The AI service is busy. Wait a moment and try again.'
        : lastStatus === 404
          ? 'The configured AI model is unavailable. Set GEMINI_MODEL to a current model.'
          : 'The AI service could not complete the request. Check GEMINI_API_KEY and try again.',
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new HttpError(502, 'The AI returned an unreadable response. Try again.');
  }
  const raw =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text ?? '')
      .join('') ?? '';
  let payload;
  try {
    payload = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
  } catch {
    throw new HttpError(502, 'The AI returned an unreadable challenge. Try again.');
  }

  return { challenge: coerceChallenge(payload, questionCount), model };
}

function allowCorsOrigin(origin, allowedOrigins, allowCredentials) {
  if (!origin) return null;
  const normalized = origin.trim();
  if (!normalized) return null;
  if (allowedOrigins.length === 0) return normalized;
  if (allowedOrigins.includes(normalized)) return normalized;
  return null;
}

function setCorsHeaders(res, origin, allowCredentials, allowedMethods) {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (allowCredentials && origin) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods ?? 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function pathWithoutQuery(pathname) {
  return pathname.split('?')[0];
}

const CORS_PRIVILEGED_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-school',
  '/api/auth/logout',
]);

function resolveCORS(req, res, actor, options) {
  const {
    allowedOrigins = [],
    allowCredentials = false,
    healthEndpoint = '/api/health',
  } = options;

  const origin = req.headers.origin?.trim() || '';
  const method = (req.method ?? 'GET').toUpperCase();
  const pathname = pathWithoutQuery(req.url?.split('?')[0] ?? '/');

  const allowAll = allowedOrigins.length === 0;

  function forPublicEndpoint() {
    if (!origin) return;
    if (allowAll) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      return;
    }
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  }

  function forPrivilegedPublicEndpoint() {
    if (CORS_PRIVILEGED_PATHS.has(pathname) && method !== 'OPTIONS') {
      if (!origin) return;
      res.setHeader('Access-Control-Allow-Origin', origin);
      if (allowAll) {
        // explicit mirror of request origin for login/register/logout/etc.
      }
    }
  }

  // Health endpoint: keep public but do not leak CORS for disallowed origins.
  if (method === 'OPTIONS' && (pathname === healthEndpoint || pathname.startsWith('/api/'))) {
    if (!origin) {
      // Non-Origin preflight: still answer 204 to unblock tooling, but without CORS mirrors.
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return true;
    }

    // For OPTIONS, gate the mirror strictly on explicit allow-list membership
    // when allowCredentials is requested.
    if (allowCredentials && !allowedOrigins.includes(origin)) {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return true;
    }

    // Otherwise mirror if allowed.
    if (allowAll || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.writeHead(204);
      res.end();
      return true;
    }

    // Disallowed origin for OPTIONS: respond with 204 but no mirror + no credentials.
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }

  // Non-OPTIONS privileged public endpoints: login/register/logout do not require auth and
  // should be callable from the app origin.
  if (CORS_PRIVILEGED_PATHS.has(pathname) && method !== 'OPTIONS') {
    if (origin) {
      if (allowAll || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        if (allowCredentials) {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
      }
    }
    return false;
  }

  // Every other API endpoint in this app requires authentication; so CORS is only meaningful
  // for the authenticated actor's origin, and we mirror it only when explicitly allowed.
  if (actor) {
    if (origin && (allowAll || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
    return false;
  }

  // Not authenticated and not a public endpoint: still set Vary if we mirrored anything.
  return false;
}

async function handle(db, req, res, options = {}) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = (req.method ?? 'GET').toUpperCase();

  const actor = actorFromRequest(req, db);
  const origin = req.headers.origin?.trim() || '';

  if (resolveCORS(req, res, actor, options)) {
    return;
  }

  if (method === 'GET' && path === options.healthEndpoint) {
    sendJson(res, 200, { ok: true, time: now() });
    return;
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await readBody(req);
    const email = normaliseEmail(body.email);
    const password = String(body.password ?? '');
    if (!email || !password) throw new HttpError(400, 'Enter your email and password.');

    const row = db.prepare(`${ACCOUNT_SELECT} WHERE lower(a.email) = ?`).get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new HttpError(401, 'Email or password is incorrect.');
    }
    const problem = loginBodyProblem(row, db);
    if (problem) throw new HttpError(403, problem);
    const token = sessionLogin(db, row.id);
    sendJson(res, 200, { token, user: mapAccount(row) });
    return;
  }

  if (method === 'POST' && path === '/api/auth/register') {
    const body = await readBody(req);
    const name = required(body.name, 'Your full name', 120);
    const email = normaliseEmail(body.email);
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    const password = String(body.password ?? '');
    if (password.length < 6) throw new HttpError(400, 'Use at least 6 characters for your password.');
    const role = text(body.role, 20).toUpperCase();
    if (!['STUDENT', 'TEACHER'].includes(role)) {
      throw new HttpError(400, 'Choose student or teacher.');
    }
    const schoolCode = text(body.schoolCode, 20).toUpperCase();
    const school = db.prepare('SELECT * FROM schools WHERE code = ?').get(schoolCode);
    if (!school) throw new HttpError(404, 'No school matches that join code.');
    if (school.status !== 'APPROVED') {
      throw new HttpError(403, 'That school is not active on Virtual Lab yet.');
    }
    if (db.prepare('SELECT 1 FROM accounts WHERE lower(email) = ?').get(email)) {
      throw new HttpError(409, 'An account with that email already exists. Sign in instead.');
    }
    const id = makeId('user');
    db.prepare(
      `INSERT INTO accounts (id, name, email, password_hash, role, school_id, class_code, grade_level, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    ).run(
      id,
      name,
      email,
      hashPassword(password),
      role,
      school.id,
      text(body.classCode, 40).toUpperCase(),
      role === 'TEACHER' ? 'Staff' : text(body.gradeLevel, 12) || 'SS1',
      now(),
    );
    sendJson(res, 201, { ok: true });
    return;
  }

  if (method === 'POST' && path === '/api/auth/register-school') {
    const body = await readBody(req);
    const name = required(body.name, 'School name', 160);
    const code = text(body.code, 20).toUpperCase();
    if (!/^[A-Z0-9-]{4,12}$/.test(code)) {
      throw new HttpError(400, 'Use 4–12 letters, numbers or dashes for the join code.');
    }
    const email = normaliseEmail(body.contactEmail);
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid contact email.');
    const password = String(body.password ?? '');
    if (password.length < 6) throw new HttpError(400, 'Use at least 6 characters for your password.');
    if (db.prepare('SELECT 1 FROM schools WHERE code = ?').get(code)) {
      throw new HttpError(409, 'That join code is already taken.');
    }
    if (db.prepare('SELECT 1 FROM accounts WHERE lower(email) = ?').get(email)) {
      throw new HttpError(409, 'An account with that email already exists.');
    }
    const schoolId = makeId('school');
    db.exec('BEGIN');
    try {
      db.prepare(
        `INSERT INTO schools (id, name, code, city, state, contact_name, contact_email, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      ).run(
        schoolId,
        name,
        code,
        text(body.city, 80),
        text(body.state, 80),
        text(body.contactName, 120),
        email,
        now(),
      );
      db.prepare(
        `INSERT INTO accounts (id, name, email, password_hash, role, school_id, class_code, grade_level, status, created_at)
         VALUES (?, ?, ?, ?, 'SCHOOL_ADMIN', ?, 'SCHOOL', 'Staff', 'PENDING', ?)`,
      ).run(
        makeId('user'),
        text(body.contactName, 120) || `${name} Admin`,
        email,
        hashPassword(password),
        schoolId,
        now(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    sendJson(res, 201, { ok: true });
    return;
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'GET' && path === '/api/auth/me') {
    requireActor(actor);
    sendJson(res, 200, { user: actor });
    return;
  }

  if (method === 'GET' && path === '/api/bootstrap') {
    requireActor(actor);
    sendJson(res, 200, bootstrap(db, actor));
    return;
  }

  const schoolStatusMatch = path.match(/^\/api\/schools\/([^/]+)\/status$/);
  if (method === 'PATCH' && schoolStatusMatch) {
    requireActor(actor);
    assertRole(actor, ['ADMIN']);
    const body = await readBody(req);
    const status = text(body.status, 20).toUpperCase();
    if (!['PENDING', 'APPROVED', 'REVOKED'].includes(status)) {
      throw new HttpError(400, 'Unknown school status.');
    }
    const school = getSchool(db, schoolStatusMatch[1]);
    if (!school) throw new HttpError(404, 'School not found.');
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE schools SET status = ?, approved_at = ? WHERE id = ?').run(
        status,
        status === 'APPROVED' ? now() : school.approved_at,
        school.id,
      );
      if (status === 'APPROVED') {
        db.prepare(
          `UPDATE accounts SET status = 'ACTIVE' WHERE school_id = ? AND status = 'PENDING'`,
        ).run(school.id);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    sendJson(res, 200, { school: mapSchool(getSchool(db, school.id)) });
    return;
  }

  const schoolMembersMatch = path.match(/^\/api\/schools\/([^/]+)\/members$/);
  if (method === 'POST' && schoolMembersMatch) {
    requireActor(actor);
    const schoolId = schoolMembersMatch[1];
    if (actor.role !== 'ADMIN' && (actor.role !== 'SCHOOL_ADMIN' || actor.schoolId !== schoolId)) {
      throw new HttpError(403, 'You do not have access to manage members for this school.');
    }
    const school = getSchool(db, schoolId);
    if (!school) throw new HttpError(404, 'School not found.');
    if (school.status === 'REVOKED') throw new HttpError(403, 'This school has been revoked.');

    const body = await readBody(req);
    const name = required(body.name, 'Full name', 120);
    const email = normaliseEmail(body.email);
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    const role = text(body.role, 20).toUpperCase();
    if (!['STUDENT', 'TEACHER'].includes(role)) {
      throw new HttpError(400, 'Role must be student or teacher.');
    }
    if (db.prepare('SELECT 1 FROM accounts WHERE lower(email) = ?').get(email)) {
      throw new HttpError(409, 'An account with that email already exists.');
    }

    const tempPassword = makeTemporaryPassword();
    const id = makeId('user');
    db.prepare(
      `INSERT INTO accounts (id, name, email, password_hash, role, school_id, class_code, grade_level, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    ).run(
      id,
      name,
      email,
      hashPassword(tempPassword),
      role,
      school.id,
      text(body.classCode, 40).toUpperCase(),
      role === 'TEACHER' ? 'Staff' : text(body.gradeLevel, 12) || 'SS2',
      now(),
    );

    const created = getAccountById(db, id);
    sendJson(res, 201, {
      ok: true,
      credentials: { email, password: tempPassword },
      member: mapAccount(created),
    });
    return;
  }

  const memberStatusMatch = path.match(/^\/api\/members\/([^/]+)\/status$/);
  if (method === 'PATCH' && memberStatusMatch) {
    requireActor(actor);
    const memberId = memberStatusMatch[1];
    const target = getAccountById(db, memberId);
    if (!target) throw new HttpError(404, 'Member not found.');

    if (
      actor.role !== 'ADMIN' &&
      (actor.role !== 'SCHOOL_ADMIN' || actor.schoolId !== target.school_id)
    ) {
      throw new HttpError(403, 'You do not have access to manage this member.');
    }

    const body = await readBody(req);
    const status = text(body.status, 20).toUpperCase();
    if (!['ACTIVE', 'PENDING', 'REVOKED'].includes(status)) {
      throw new HttpError(400, 'Unknown status.');
    }

    db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(status, memberId);
    const updated = getAccountById(db, memberId);
    sendJson(res, 200, { member: mapAccount(updated) });
    return;
  }

  const attemptReviewMatch = path.match(/^\/api\/attempts\/([^/]+)\/review$/);
  if (method === 'PATCH' && attemptReviewMatch) {
    requireActor(actor);
    const attemptId = attemptReviewMatch[1];
    const attempt = getAttempt(db, attemptId);
    if (!attempt) throw new HttpError(404, 'Attempt not found.');
    const student = getAccountById(db, attempt.student_id);
    if (!canReview(actor, attempt, student)) {
      throw new HttpError(403, 'You do not have permission to mark this student’s attempt.');
    }

    const score = parseJson(attempt.score_json, null);
    const body = await readBody(req);
    const validMarks = validateMarks(score, body.marks);
    const comment = text(body.comment, 500);

    const review = {
      reviewerId: actor.id,
      reviewerName: actor.name,
      marks: validMarks,
      comment,
      reviewedAt: now(),
    };

    db.prepare('UPDATE attempts SET review_json = ? WHERE id = ?').run(
      JSON.stringify(review),
      attemptId,
    );
    const updated = getAttempt(db, attemptId);
    sendJson(res, 200, { attempt: mapAttempt(updated) });
    return;
  }

  if (method === 'DELETE' && attemptReviewMatch) {
    requireActor(actor);
    const attemptId = attemptReviewMatch[1];
    const attempt = getAttempt(db, attemptId);
    if (!attempt) throw new HttpError(404, 'Attempt not found.');
    const student = getAccountById(db, attempt.student_id);
    if (!canReview(actor, attempt, student)) {
      throw new HttpError(403, 'You do not have permission to remove marks for this attempt.');
    }
    db.prepare('UPDATE attempts SET review_json = NULL WHERE id = ?').run(attemptId);
    const updated = getAttempt(db, attemptId);
    sendJson(res, 200, { attempt: mapAttempt(updated) });
    return;
  }

  if (method === 'POST' && path === '/api/assignments') {
    requireActor(actor);
    assertRole(actor, ['TEACHER']);
    const body = await readBody(req);
    const title = required(body.title, 'Test title', 160);
    const experimentCode = required(body.experimentCode, 'Practical', 20).toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(experimentCode)) {
      throw new HttpError(400, 'Choose a valid practical for this test.');
    }
    const classCode = text(body.classCode, 40).toUpperCase() || actor.classCode;
    if (classCode !== actor.classCode) {
      throw new HttpError(403, 'You can only set tests for your own class.');
    }
    const source = text(body.source, 10).toUpperCase() === 'AI' ? 'AI' : 'TEACHER';
    const id = makeId('test');
    db.prepare(
      `INSERT INTO assignments (id, teacher_id, school_id, class_code, title, experiment_code,
         instructions, due_at, params_json, questions_json, marking_guide, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      actor.id,
      actor.schoolId,
      classCode,
      title,
      experimentCode,
      text(body.instructions, 2000),
      text(body.dueAt, 40) || null,
      JSON.stringify(numberMap(body.params)),
      JSON.stringify(cleanQuestions(body.questions)),
      text(body.markingGuide, 4000),
      source,
      now(),
    );
    const created = db.prepare(`${ASSIGNMENT_SELECT} WHERE asg.id = ?`).get(id);
    sendJson(res, 201, { assignment: mapAssignment(created) });
    return;
  }

  const assignmentMatch = path.match(/^\/api\/assignments\/([^/]+)$/);
  if (method === 'DELETE' && assignmentMatch) {
    requireActor(actor);
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentMatch[1]);
    if (!assignment) throw new HttpError(404, 'Test not found.');
    if (actor.role !== 'ADMIN' && assignment.teacher_id !== actor.id) {
      throw new HttpError(403, 'You can only remove tests you set.');
    }
    db.prepare('DELETE FROM assignments WHERE id = ?').run(assignment.id);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && path === '/api/ai/challenge') {
    requireActor(actor);
    assertRole(actor, ['TEACHER', 'ADMIN']);
    const body = await readBody(req);
    const result = await generateAiChallenge(body);
    sendJson(res, 200, result);
    return;
  }

  const attemptSubmitMatch = path.match(/^\/api\/attempts\/([^/]+)\/submit$/);
  if (method === 'POST' && attemptSubmitMatch) {
    requireActor(actor);
    assertRole(actor, ['STUDENT']);
    const attemptId = attemptSubmitMatch[1];
    const existing = getAttempt(db, attemptId);
    if (existing && existing.student_id !== actor.id) {
      throw new HttpError(403, 'You do not own this attempt.');
    }

    const body = await readBody(req);
    const experimentCode = text(body.experimentCode, 30);
    const seed = Number(body.seed) || (existing ? Number(existing.seed) : 0);
    const rowsJson = JSON.stringify(body.rows ?? []);
    const answersJson = JSON.stringify(body.answers ?? {});
    const graphJson = body.graph ? JSON.stringify(body.graph) : null;
    const flagsJson = JSON.stringify(body.flags ?? {});
    const notes = text(body.notes, 2000);
    const scoreJson = body.score ? JSON.stringify(body.score) : null;
    const scenarioJson = body.scenarioSnapshot ? JSON.stringify(body.scenarioSnapshot) : null;
    const paramsJson = JSON.stringify(numberMap(body.params));
    const challengeJson = JSON.stringify(body.challenge ?? {});
    const assignmentId = text(body.assignmentId, 60) || null;
    if (assignmentId) {
      const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
      if (
        !assignment ||
        assignment.school_id !== actor.schoolId ||
        assignment.class_code !== actor.classCode
      ) {
        throw new HttpError(403, 'That test is not assigned to your class.');
      }
    }
    const submittedAt = text(body.submittedAt, 40) || now();

    if (existing) {
      db.prepare(
        `UPDATE attempts
         SET status = 'SCORED', delivery = 'delivered', submitted_at = ?,
             rows_json = ?, answers_json = ?, graph_json = ?, flags_json = ?, notes = ?,
             score_json = ?, scenario_json = ?, params_json = ?, assignment_id = ?, challenge_json = ?
         WHERE id = ?`,
      ).run(
        submittedAt,
        rowsJson,
        answersJson,
        graphJson,
        flagsJson,
        notes,
        scoreJson,
        scenarioJson,
        paramsJson,
        assignmentId,
        challengeJson,
        attemptId,
      );
    } else {
      db.prepare(
        `INSERT INTO attempts (id, student_id, experiment_code, seed, status, delivery, config_version, idempotency_key,
           started_at, submitted_at, rows_json, answers_json, graph_json, flags_json, notes, score_json, scenario_json,
           params_json, assignment_id, challenge_json)
         VALUES (?, ?, ?, ?, 'SCORED', 'delivered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        attemptId,
        actor.id,
        experimentCode,
        seed,
        Number(body.configVersion) || 1,
        text(body.idempotencyKey, 64) || makeId('idem'),
        text(body.startedAt, 40) || submittedAt,
        submittedAt,
        rowsJson,
        answersJson,
        graphJson,
        flagsJson,
        notes,
        scoreJson,
        scenarioJson,
        paramsJson,
        assignmentId,
        challengeJson,
      );
    }

    const submitted = getAttempt(db, attemptId);
    sendJson(res, 200, { attempt: mapAttempt(submitted) });
    return;
  }

  const attemptMatch = path.match(/^\/api\/attempts\/([^/]+)$/);
  if (method === 'PUT' && attemptMatch) {
    requireActor(actor);
    assertRole(actor, ['STUDENT']);
    const attemptId = attemptMatch[1];
    const existing = getAttempt(db, attemptId);
    if (existing && existing.student_id !== actor.id) {
      throw new HttpError(403, 'You do not own this attempt.');
    }
    if (existing && existing.status === 'SCORED') {
      throw new HttpError(409, 'Cannot modify an already scored attempt.');
    }

    const body = await readBody(req);
    const experimentCode = text(body.experimentCode, 30);
    const seed = Number(body.seed) || 0;
    const rowsJson = JSON.stringify(body.rows ?? []);
    const answersJson = JSON.stringify(body.answers ?? {});
    const graphJson = body.graph ? JSON.stringify(body.graph) : null;
    const flagsJson = JSON.stringify(body.flags ?? {});
    const notes = text(body.notes, 2000);
    const paramsJson = JSON.stringify(numberMap(body.params));
    const challengeJson = JSON.stringify(body.challenge ?? {});
    const assignmentId = text(body.assignmentId, 60) || null;
    if (assignmentId) {
      const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
      if (
        !assignment ||
        assignment.school_id !== actor.schoolId ||
        assignment.class_code !== actor.classCode
      ) {
        throw new HttpError(403, 'That test is not assigned to your class.');
      }
    }

    if (existing) {
      db.prepare(
        `UPDATE attempts
         SET rows_json = ?, answers_json = ?, graph_json = ?, flags_json = ?, notes = ?,
             params_json = ?, assignment_id = ?, challenge_json = ?
         WHERE id = ?`,
      ).run(
        rowsJson,
        answersJson,
        graphJson,
        flagsJson,
        notes,
        paramsJson,
        assignmentId,
        challengeJson,
        attemptId,
      );
    } else {
      db.prepare(
        `INSERT INTO attempts (id, student_id, experiment_code, seed, status, delivery, config_version, idempotency_key,
           started_at, rows_json, answers_json, graph_json, flags_json, notes, params_json, assignment_id, challenge_json)
         VALUES (?, ?, ?, ?, 'IN_PROGRESS', 'not-submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        attemptId,
        actor.id,
        experimentCode,
        seed,
        Number(body.configVersion) || 1,
        text(body.idempotencyKey, 64) || makeId('idem'),
        text(body.startedAt, 40) || now(),
        rowsJson,
        answersJson,
        graphJson,
        flagsJson,
        notes,
        paramsJson,
        assignmentId,
        challengeJson,
      );
    }

    const saved = getAttempt(db, attemptId);
    sendJson(res, 200, { attempt: mapAttempt(saved) });
    return;
  }

  if (method === 'DELETE' && attemptMatch) {
    requireActor(actor);
    const attemptId = attemptMatch[1];
    const existing = getAttempt(db, attemptId);
    if (!existing) {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (existing.student_id !== actor.id && actor.role !== 'ADMIN') {
      throw new HttpError(403, 'You do not own this attempt.');
    }
    if (existing.status !== 'IN_PROGRESS') {
      throw new HttpError(409, 'Cannot discard an already submitted attempt.');
    }
    db.prepare('DELETE FROM attempts WHERE id = ?').run(attemptId);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(404, 'Not found');
}

export function createApiHandler(dbArg, options = {}) {
  const db = dbArg;
  const {
    allowedOrigins = [],
    allowCredentials = false,
    healthEndpoint = '/api/health',
  } = options;

  return async (req, res) => {
    try {
      await handle(db, req, res, {
        allowedOrigins,
        allowCredentials,
        healthEndpoint,
      });
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      console.error('Unhandled API error:', err);
      sendJson(res, 500, { error: 'An internal error occurred.' });
    }
  };
}
