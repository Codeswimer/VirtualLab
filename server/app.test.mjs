import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase, SCHEMA_VERSION } from './db.mjs';
import { createApiHandler } from './app.mjs';

/** The attempts table as written by v0.2, before params, assignments and challenges. */
const LEGACY_SCHEMA = `
  CREATE TABLE schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    approved_at TEXT
  );

  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    school_id TEXT REFERENCES schools(id),
    class_code TEXT NOT NULL DEFAULT '',
    grade_level TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE attempts (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    experiment_code TEXT NOT NULL,
    seed INTEGER NOT NULL,
    status TEXT NOT NULL,
    delivery TEXT NOT NULL DEFAULT 'not-submitted',
    config_version INTEGER NOT NULL DEFAULT 1,
    idempotency_key TEXT NOT NULL,
    started_at TEXT,
    submitted_at TEXT,
    rows_json TEXT NOT NULL DEFAULT '[]',
    answers_json TEXT NOT NULL DEFAULT '{}',
    graph_json TEXT,
    flags_json TEXT NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    score_json TEXT,
    review_json TEXT,
    scenario_json TEXT
  );
`;

function withLegacyDatabase(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vlab-migrate-'));
  const file = path.join(dir, 'vlab.db');
  const legacy = new DatabaseSync(file);
  legacy.exec(LEGACY_SCHEMA);
  legacy.close();
  try {
    return run(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function attemptColumns(db) {
  return db.prepare('PRAGMA table_info(attempts)').all().map((column) => column.name);
}

async function withLab(run) {
  const db = createDatabase(':memory:');
  const server = createServer(createApiHandler(db));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await run({ base });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
}

async function request(base, path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, body: data };
}

async function signIn(base, email, password) {
  const response = await request(base, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return response;
}

test('a database from an older version is migrated in place on start', () => {
  withLegacyDatabase((file) => {
    let seeded = 0;
    const db = createDatabase(file);
    try {
      const columns = attemptColumns(db);
      for (const column of ['params_json', 'assignment_id', 'challenge_json']) {
        assert.ok(columns.includes(column), `migration added attempts.${column}`);
      }

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'attempts'")
        .all()
        .map((entry) => entry.name);
      assert.ok(indexes.includes('idx_attempts_assignment'), 'index on the migrated column exists');

      assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
      // The legacy file was empty, so the demo data is seeded into the migrated tables.
      assert.ok(db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count > 0);
      const attempts = db
        .prepare('SELECT COUNT(*) AS total, SUM(challenge_json = \'{}\') AS defaulted FROM attempts')
        .get();
      assert.ok(attempts.total > 0);
      // Every migrated row gets the column default rather than a NULL.
      assert.equal(Number(attempts.defaulted), Number(attempts.total));
      seeded = Number(attempts.total);
    } finally {
      db.close();
    }

    // Re-opening a migrated file must not re-run the migration or reseed it.
    const reopened = createDatabase(file);
    try {
      assert.equal(reopened.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
      assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM attempts').get().count, seeded);
    } finally {
      reopened.close();
    }
  });
});

test('a fresh database is created at the current schema version', () => {
  const db = createDatabase(':memory:');
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
    const columns = attemptColumns(db);
    for (const column of ['params_json', 'assignment_id', 'challenge_json']) {
      assert.ok(columns.includes(column), `fresh schema includes attempts.${column}`);
    }
  } finally {
    db.close();
  }
});

test('students only receive their own data, plus a sanitised global leaderboard', async () => {
  await withLab(async ({ base }) => {
    const login = await signIn(base, 'ada@vlab.ng', 'student123');
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    const token = login.body.token;

    const bootstrap = await request(base, '/api/bootstrap', { token });
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.body.user.id, 'demo-student');
    assert.equal(bootstrap.body.accounts.length, 1);
    assert.ok(bootstrap.body.attempts.every((attempt) => attempt.studentId === 'demo-student'));
    assert.ok(bootstrap.body.leaderboard.some((row) => row.name === 'Ifeoma Eze'));
    assert.ok(
      bootstrap.body.leaderboard.every((row) => !('email' in row) && !('contactEmail' in row)),
    );

    const reviewed = bootstrap.body.attempts.find((attempt) => attempt.experimentCode === 'PHY-08');
    assert.equal(reviewed.review.marks, 32);
    assert.equal(reviewed.review.reviewerName, 'Mr. Bello');
  });
});

test('a school stays blocked until the owner approves it', async () => {
  await withLab(async ({ base }) => {
    const pendingStudent = await signIn(base, 'ngozi@vlab.ng', 'student123');
    assert.equal(pendingStudent.status, 403);
    assert.match(pendingStudent.body.error, /waiting for your school administrator/i);

    const pendingSchool = await signIn(base, 'admin@greenfield.edu.ng', 'school123');
    assert.equal(pendingSchool.status, 403);
    assert.match(pendingSchool.body.error, /platform approval/i);

    const owner = await signIn(base, 'owner@vlab.ng', 'owner123');
    assert.equal(owner.status, 200);
    const approved = await request(base, '/api/schools/school-gfa/status', {
      method: 'PATCH',
      token: owner.body.token,
      body: { status: 'APPROVED' },
    });
    assert.equal(approved.status, 200);

    const schoolAdmin = await signIn(base, 'admin@greenfield.edu.ng', 'school123');
    assert.equal(schoolAdmin.status, 200);
    const bootstrap = await request(base, '/api/bootstrap', { token: schoolAdmin.body.token });
    assert.equal(bootstrap.body.schools.length, 1);
    assert.equal(bootstrap.body.schools[0].status, 'APPROVED');
  });
});

test('a school admin can onboard and revoke a student', async () => {
  await withLab(async ({ base }) => {
    const admin = await signIn(base, 'admin@kingscollege.edu.ng', 'school123');
    assert.equal(admin.status, 200);
    const created = await request(base, '/api/schools/school-kcl/members', {
      method: 'POST',
      token: admin.body.token,
      body: {
        name: 'Test Student',
        email: 'new.student@kingscollege.edu.ng',
        role: 'STUDENT',
        classCode: 'SS2A-KCL',
        gradeLevel: 'SS2',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.credentials.email, 'new.student@kingscollege.edu.ng');
    assert.ok(created.body.credentials.password.startsWith('vlab'));

    const student = await signIn(
      base,
      created.body.credentials.email,
      created.body.credentials.password,
    );
    assert.equal(student.status, 200);

    const revoked = await request(base, `/api/members/${created.body.member.id}/status`, {
      method: 'PATCH',
      token: admin.body.token,
      body: { status: 'REVOKED' },
    });
    assert.equal(revoked.status, 200);

    const blocked = await signIn(
      base,
      created.body.credentials.email,
      created.body.credentials.password,
    );
    assert.equal(blocked.status, 403);
    assert.match(blocked.body.error, /revoked/i);
  });
});

test('teachers can mark their own class only, and students see the mark', async () => {
  await withLab(async ({ base }) => {
    const teacher = await signIn(base, 'bello@vlab.ng', 'teacher123');
    assert.equal(teacher.status, 200);

    const marked = await request(base, '/api/attempts/demo-attempt-1/review', {
      method: 'PATCH',
      token: teacher.body.token,
      body: { marks: 20, comment: 'Review the burette reading precision.' },
    });
    assert.equal(marked.status, 200);
    assert.equal(marked.body.attempt.review.marks, 20);
    assert.equal(marked.body.attempt.review.reviewerName, 'Mr. Bello');

    const tooMany = await request(base, '/api/attempts/demo-attempt-1/review', {
      method: 'PATCH',
      token: teacher.body.token,
      body: { marks: 100, comment: 'Out of range' },
    });
    assert.equal(tooMany.status, 400);

    const otherClass = await request(base, '/api/attempts/demo-attempt-28/review', {
      method: 'PATCH',
      token: teacher.body.token,
      body: { marks: 30, comment: 'Not my class' },
    });
    assert.equal(otherClass.status, 403);

    const student = await signIn(base, 'ada@vlab.ng', 'student123');
    const studentBootstrap = await request(base, '/api/bootstrap', { token: student.body.token });
    const attempt = studentBootstrap.body.attempts.find(
      (candidate) => candidate.id === 'demo-attempt-1',
    );
    assert.equal(attempt.review.marks, 20);

    const studentReview = await request(base, '/api/attempts/demo-attempt-1/review', {
      method: 'PATCH',
      token: student.body.token,
      body: { marks: 40, comment: 'Self-marking' },
    });
    assert.equal(studentReview.status, 403);
  });
});

test('attempt drafts and submissions persist and respect ownership', async () => {
  await withLab(async ({ base }) => {
    const student = await signIn(base, 'ada@vlab.ng', 'student123');
    const draft = await request(base, '/api/attempts/attempt_test_1', {
      method: 'PUT',
      token: student.body.token,
      body: {
        experimentCode: 'PHY-01',
        seed: 4242,
        rows: [{ length: '0.80', time: '17.9' }],
        answers: {},
        graph: null,
        notes: 'Draft saved from a device',
      },
    });
    assert.equal(draft.status, 200);
    assert.equal(draft.body.attempt.status, 'IN_PROGRESS');

    const submitted = await request(base, '/api/attempts/attempt_test_1/submit', {
      method: 'POST',
      token: student.body.token,
      body: {
        experimentCode: 'PHY-01',
        seed: 4242,
        rows: [{ length: '0.80', time: '17.9' }],
        score: { total: 30, max: 40, percent: 75, grade: 'A1', criteria: [], summary: 'Saved' },
      },
    });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.attempt.status, 'SCORED');
    assert.equal(submitted.body.attempt.score.percent, 75);

    const bootstrap = await request(base, '/api/bootstrap', { token: student.body.token });
    assert.ok(bootstrap.body.attempts.some((attempt) => attempt.id === 'attempt_test_1'));

    const otherStudent = await signIn(base, 'chidi@vlab.ng', 'student123');
    const overwrite = await request(base, '/api/attempts/attempt_test_1', {
      method: 'PUT',
      token: otherStudent.body.token,
      body: { experimentCode: 'PHY-01', seed: 4242, rows: [] },
    });
    assert.equal(overwrite.status, 403);

    const discard = await request(base, '/api/attempts/attempt_test_1', {
      method: 'DELETE',
      token: student.body.token,
    });
    assert.equal(discard.status, 409);
  });
});

test('revoking a school blocks its teachers and admins until restored', async () => {
  await withLab(async ({ base }) => {
    const owner = await signIn(base, 'owner@vlab.ng', 'owner123');
    const revoke = await request(base, '/api/schools/school-kcl/status', {
      method: 'PATCH',
      token: owner.body.token,
      body: { status: 'REVOKED' },
    });
    assert.equal(revoke.status, 200);

    const blocked = await signIn(base, 'bello@vlab.ng', 'teacher123');
    assert.equal(blocked.status, 403);
    assert.match(blocked.body.error, /revoked by the platform owner/i);

    const restore = await request(base, '/api/schools/school-kcl/status', {
      method: 'PATCH',
      token: owner.body.token,
      body: { status: 'APPROVED' },
    });
    assert.equal(restore.status, 200);
    const teacher = await signIn(base, 'bello@vlab.ng', 'teacher123');
    assert.equal(teacher.status, 200);
  });
});

test('teachers publish tests to their class and marking guides stay private', async () => {
  await withLab(async ({ base }) => {
    const teacher = await signIn(base, 'bello@vlab.ng', 'teacher123');
    const created = await request(base, '/api/assignments', {
      method: 'POST',
      token: teacher.body.token,
      body: {
        title: 'Pendulum class test',
        experimentCode: 'PHY-01',
        instructions: 'Use the amplitude your teacher selected.',
        params: { amplitudeDeg: 8 },
        questions: [
          {
            prompt: 'Why time many oscillations?',
            marks: 3,
            markingGuide: 'Reduces percentage error in the stopwatch reading.',
          },
        ],
        markingGuide: 'General guide for the examiner.',
      },
    });
    assert.equal(created.status, 201);
    const assignmentId = created.body.assignment.id;
    assert.equal(created.body.assignment.params.amplitudeDeg, 8);
    assert.match(created.body.assignment.markingGuide, /General guide/);

    const student = await signIn(base, 'ada@vlab.ng', 'student123');
    const studentBootstrap = await request(base, '/api/bootstrap', { token: student.body.token });
    const seen = studentBootstrap.body.assignments.find((entry) => entry.id === assignmentId);
    assert.ok(seen, 'the test is visible to the class');
    assert.equal(seen.markingGuide, '');
    assert.equal(seen.questions[0].markingGuide, '');
    assert.equal(seen.questions[0].prompt, 'Why time many oscillations?');

    const otherClass = await signIn(base, 'ifeoma@fgc.ng', 'student123');
    const forbidden = await request(base, '/api/attempts/attempt_assign_other', {
      method: 'PUT',
      token: otherClass.body.token,
      body: {
        experimentCode: 'PHY-01',
        seed: 42,
        assignmentId,
        params: { amplitudeDeg: 8 },
      },
    });
    assert.equal(forbidden.status, 403);

    const draft = await request(base, '/api/attempts/attempt_assign_1', {
      method: 'PUT',
      token: student.body.token,
      body: {
        experimentCode: 'PHY-01',
        seed: 42,
        assignmentId,
        params: { amplitudeDeg: 8 },
        rows: [{ length: '0.60' }],
      },
    });
    assert.equal(draft.status, 200);
    assert.equal(draft.body.attempt.assignmentId, assignmentId);
    assert.equal(draft.body.attempt.params.amplitudeDeg, 8);

    const submitted = await request(base, '/api/attempts/attempt_assign_1/submit', {
      method: 'POST',
      token: student.body.token,
      body: {
        experimentCode: 'PHY-01',
        seed: 42,
        assignmentId,
        params: { amplitudeDeg: 8 },
        rows: [{ length: '0.60' }],
        challenge: { q1: 'Timing many swings reduces the stopwatch error.' },
        score: { total: 30, max: 40, percent: 75, grade: 'A1', criteria: [], summary: 'Saved' },
      },
    });
    assert.equal(submitted.status, 200);
    assert.match(submitted.body.attempt.challenge.q1, /stopwatch/);

    const ai = await request(base, '/api/ai/challenge', {
      method: 'POST',
      token: student.body.token,
      body: { subject: 'PHYSICS' },
    });
    assert.equal(ai.status, 403);

    const removed = await request(base, `/api/assignments/${assignmentId}`, {
      method: 'DELETE',
      token: teacher.body.token,
    });
    assert.equal(removed.status, 200);
  });
});
