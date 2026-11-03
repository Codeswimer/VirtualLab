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
  };
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
    const submittedAt = text(body.submittedAt, 40) || now();

    if (existing) {
      db.prepare(
        `UPDATE attempts
         SET status = 'SCORED', delivery = 'delivered', submitted_at = ?,
             rows_json = ?, answers_json = ?, graph_json = ?, flags_json = ?, notes = ?,
             score_json = ?, scenario_json = ?
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
        attemptId,
      );
    } else {
      db.prepare(
        `INSERT INTO attempts (id, student_id, experiment_code, seed, status, delivery, config_version, idempotency_key,
           started_at, submitted_at, rows_json, answers_json, graph_json, flags_json, notes, score_json, scenario_json)
         VALUES (?, ?, ?, ?, 'SCORED', 'delivered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    if (existing) {
      db.prepare(
        `UPDATE attempts
         SET rows_json = ?, answers_json = ?, graph_json = ?, flags_json = ?, notes = ?
         WHERE id = ?`,
      ).run(rowsJson, answersJson, graphJson, flagsJson, notes, attemptId);
    } else {
      db.prepare(
        `INSERT INTO attempts (id, student_id, experiment_code, seed, status, delivery, config_version, idempotency_key,
           started_at, rows_json, answers_json, graph_json, flags_json, notes)
         VALUES (?, ?, ?, ?, 'IN_PROGRESS', 'not-submitted', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
