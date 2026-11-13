import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, makeId } from './security.mjs';

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REVOKED')),
    created_at TEXT NOT NULL,
    approved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT')),
    school_id TEXT REFERENCES schools(id),
    class_code TEXT NOT NULL DEFAULT '',
    grade_level TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    experiment_code TEXT NOT NULL,
    seed INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'SCORED')),
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
    scenario_json TEXT,
    params_json TEXT NOT NULL DEFAULT '{}',
    assignment_id TEXT,
    challenge_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    school_id TEXT NOT NULL,
    class_code TEXT NOT NULL,
    title TEXT NOT NULL,
    experiment_code TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    due_at TEXT,
    params_json TEXT NOT NULL DEFAULT '{}',
    questions_json TEXT NOT NULL DEFAULT '[]',
    marking_guide TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'TEACHER' CHECK (source IN ('TEACHER', 'AI')),
    created_at TEXT NOT NULL
  );

`;

// Kept separate from SCHEMA so indexes are only created once `migrate` has
// upgraded databases produced by older versions (e.g. a missing assignment_id).
const INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_accounts_school ON accounts(school_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(school_id, class_code);
  CREATE INDEX IF NOT EXISTS idx_attempts_assignment ON attempts(assignment_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_experiment ON attempts(experiment_code);
`;

const now = () => new Date().toISOString();

function daysAgo(days, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
}

function gradeFor(percent) {
  if (percent >= 75) return 'A1';
  if (percent >= 70) return 'B2';
  if (percent >= 65) return 'B3';
  if (percent >= 60) return 'C4';
  if (percent >= 55) return 'C5';
  if (percent >= 50) return 'C6';
  if (percent >= 45) return 'D7';
  if (percent >= 40) return 'E8';
  return 'F9';
}

const DEMO_MAX = 40;

function demoScore(percent) {
  const total = Math.round((percent / 100) * DEMO_MAX * 2) / 2;
  const parts = [
    ['readings', 'Readings recorded and accurate', 'table', 0.35],
    ['graph', 'Graph plotted with labelled axes', 'graph', 0.25],
    ['calculation', 'Calculations and gradient', 'calculation', 0.25],
    ['conclusion', 'Conclusion / inference', 'conclusion', 0.15],
  ];
  const criteria = parts.map(([id, label, kind, share]) => ({
    id,
    label,
    kind,
    max: Math.round(share * DEMO_MAX * 2) / 2,
    awarded: Math.round(share * total * 2) / 2,
    feedback:
      id === 'readings'
        ? 'Readings were recorded consistently and match the apparatus scales.'
        : id === 'graph'
          ? 'Both axes carry a quantity and unit, and the best-fit line follows the points.'
          : id === 'calculation'
            ? 'Working shown with the expected significant figures.'
            : 'Conclusion names the quantity found and relates it to the theory.',
  }));
  const sum = criteria.reduce((value, criterion) => value + criterion.awarded, 0);
  const computed = Math.round((sum / DEMO_MAX) * 1000) / 10;
  return {
    total: sum,
    max: DEMO_MAX,
    percent: computed,
    grade: gradeFor(computed),
    criteria,
    summary:
      computed >= 75
        ? 'Excellent practical work — examination-ready presentation.'
        : 'Solid submission. Review the lower-scoring criteria before your next practical.',
  };
}

const SCHOOLS = [
  {
    id: 'school-kcl',
    name: "King's College",
    code: 'KCL-LAG',
    city: 'Lagos',
    state: 'Lagos',
    contactName: 'Mrs. Folake Adeyemi',
    contactEmail: 'admin@kingscollege.edu.ng',
    status: 'APPROVED',
    createdAt: daysAgo(96),
    approvedAt: daysAgo(95),
  },
  {
    id: 'school-fgc',
    name: 'Federal Government College',
    code: 'FGC-ENU',
    city: 'Enugu',
    state: 'Enugu',
    contactName: 'Mr. Godwin Nnamdi',
    contactEmail: 'admin@fgc-enugu.edu.ng',
    status: 'APPROVED',
    createdAt: daysAgo(74),
    approvedAt: daysAgo(72),
  },
  {
    id: 'school-gfa',
    name: 'Greenfield Academy',
    code: 'GFA-IBD',
    city: 'Ibadan',
    state: 'Oyo',
    contactName: 'Mrs. Bisi Oladipo',
    contactEmail: 'admin@greenfield.edu.ng',
    status: 'PENDING',
    createdAt: daysAgo(3),
    approvedAt: null,
  },
];

const ACCOUNTS = [
  ['demo-owner', 'Dr. Ngozi Eze', 'owner@vlab.ng', 'owner123', 'ADMIN', null, 'HQ', 'Owner', 'ACTIVE', 120],
  ['demo-school-kcl', 'Mrs. Folake Adeyemi', 'admin@kingscollege.edu.ng', 'school123', 'SCHOOL_ADMIN', 'school-kcl', 'SCHOOL', 'Staff', 'ACTIVE', 95],
  ['demo-school-fgc', 'Mr. Godwin Nnamdi', 'admin@fgc-enugu.edu.ng', 'school123', 'SCHOOL_ADMIN', 'school-fgc', 'SCHOOL', 'Staff', 'ACTIVE', 72],
  ['demo-school-gfa', 'Mrs. Bisi Oladipo', 'admin@greenfield.edu.ng', 'school123', 'SCHOOL_ADMIN', 'school-gfa', 'SCHOOL', 'Staff', 'PENDING', 3],
  ['demo-teacher', 'Mr. Bello', 'bello@vlab.ng', 'teacher123', 'TEACHER', 'school-kcl', 'SS2A-KCL', 'Staff', 'ACTIVE', 94],
  ['demo-teacher-fgc', 'Ms. Chiamaka Ude', 'ude@fgc-enugu.edu.ng', 'teacher123', 'TEACHER', 'school-fgc', 'SS2A-FGC', 'Staff', 'ACTIVE', 70],
  ['demo-student', 'Ada Obi', 'ada@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2A-KCL', 'SS2', 'ACTIVE', 90],
  ['demo-s-chidi', 'Chidi Nwankwo', 'chidi@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2A-KCL', 'SS2', 'ACTIVE', 90],
  ['demo-s-fatima', 'Fatima Bello', 'fatima@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2A-KCL', 'SS2', 'ACTIVE', 89],
  ['demo-s-tunde', 'Tunde Adebayo', 'tunde@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2A-KCL', 'SS2', 'ACTIVE', 88],
  ['demo-s-zainab', 'Zainab Musa', 'zainab@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2A-KCL', 'SS2', 'ACTIVE', 88],
  ['demo-s-emeka', 'Emeka Okafor', 'emeka@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2A-KCL', 'SS2', 'ACTIVE', 86],
  ['demo-s-halima', 'Halima Yusuf', 'halima@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2B-KCL', 'SS2', 'ACTIVE', 85],
  ['demo-s-kelechi', 'Kelechi Eze', 'kelechi@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2B-KCL', 'SS2', 'ACTIVE', 85],
  ['demo-s-ngozi', 'Ngozi Umeh', 'ngozi@vlab.ng', 'student123', 'STUDENT', 'school-kcl', 'SS2A-KCL', 'SS2', 'PENDING', 1],
  ['demo-s-ifeoma', 'Ifeoma Eze', 'ifeoma@fgc.ng', 'student123', 'STUDENT', 'school-fgc', 'SS2A-FGC', 'SS2', 'ACTIVE', 68],
  ['demo-s-sani', 'Sani Abubakar', 'sani@fgc.ng', 'student123', 'STUDENT', 'school-fgc', 'SS2A-FGC', 'SS2', 'ACTIVE', 67],
  ['demo-s-blessing', 'Blessing Okon', 'blessing@fgc.ng', 'student123', 'STUDENT', 'school-fgc', 'SS2A-FGC', 'SS2', 'ACTIVE', 66],
  ['demo-s-david', 'David Ekpo', 'david@fgc.ng', 'student123', 'STUDENT', 'school-fgc', 'SS2A-FGC', 'SS2', 'ACTIVE', 65],
];

// [studentId, experimentCode, percent, daysAgo]
const SEED_ATTEMPTS = [
  ['demo-student', 'CHM-01', 84, 2],
  ['demo-student', 'PHY-01', 78, 5],
  ['demo-student', 'PHY-08', 66, 8],
  ['demo-student', 'PHY-11', 72, 12],
  ['demo-s-chidi', 'PHY-01', 91, 1],
  ['demo-s-chidi', 'PHY-02', 85, 4],
  ['demo-s-chidi', 'CHM-01', 69, 7],
  ['demo-s-chidi', 'PHY-12', 88, 10],
  ['demo-s-fatima', 'CHM-01', 76, 2],
  ['demo-s-fatima', 'CHM-04', 81, 6],
  ['demo-s-fatima', 'PHY-01', 64, 9],
  ['demo-s-tunde', 'PHY-01', 58, 3],
  ['demo-s-tunde', 'PHY-08', 62, 6],
  ['demo-s-tunde', 'PHY-11', 49, 11],
  ['demo-s-tunde', 'CHM-01', 71, 13],
  ['demo-s-zainab', 'PHY-01', 70, 2],
  ['demo-s-zainab', 'PHY-02', 74, 5],
  ['demo-s-zainab', 'CHM-01', 88, 9],
  ['demo-s-emeka', 'PHY-01', 46, 4],
  ['demo-s-emeka', 'PHY-08', 53, 7],
  ['demo-s-emeka', 'PHY-14', 61, 12],
  ['demo-s-halima', 'CHM-01', 79, 3],
  ['demo-s-halima', 'CHM-02', 73, 8],
  ['demo-s-halima', 'PHY-01', 82, 11],
  ['demo-s-kelechi', 'PHY-01', 67, 5],
  ['demo-s-kelechi', 'PHY-08', 71, 9],
  ['demo-s-kelechi', 'CHM-01', 63, 14],
  ['demo-s-ifeoma', 'PHY-01', 89, 2],
  ['demo-s-ifeoma', 'CHM-01', 92, 6],
  ['demo-s-sani', 'PHY-01', 74, 3],
  ['demo-s-sani', 'PHY-08', 69, 7],
  ['demo-s-sani', 'CHM-01', 71, 10],
  ['demo-s-blessing', 'CHM-01', 83, 4],
  ['demo-s-blessing', 'CHM-04', 77, 8],
  ['demo-s-david', 'PHY-01', 55, 5],
  ['demo-s-david', 'PHY-02', 60, 9],
  ['demo-s-david', 'CHM-01', 58, 12],
];

function addColumn(db, table, column, ddl) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

/**
 * Migrations for databases written by an earlier version, applied in order and
 * tracked with SQLite's own `PRAGMA user_version`.
 *
 * `SCHEMA` above always describes the newest shape, so a fresh database needs
 * no migrations. Any change to an existing table must therefore appear in both
 * places: in `SCHEMA` for new files and as a new entry here so that existing
 * `server/data/*.db` files are upgraded in place on the next start.
 */
const MIGRATIONS = [
  {
    version: 1,
    description: 'attempt params, assignment link and challenge answers',
    up(db) {
      addColumn(db, 'attempts', 'params_json', "TEXT NOT NULL DEFAULT '{}'");
      addColumn(db, 'attempts', 'assignment_id', 'TEXT');
      addColumn(db, 'attempts', 'challenge_json', "TEXT NOT NULL DEFAULT '{}'");
    },
  },
];

const SCHEMA_VERSION = MIGRATIONS.reduce((latest, entry) => Math.max(latest, entry.version), 0);

/** Runs every migration newer than the database's `user_version`, one at a time. */
function migrate(db) {
  const stored = Number(db.prepare('PRAGMA user_version').get().user_version) || 0;
  let current = stored;
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec('BEGIN');
    try {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      error.message = `migration ${migration.version} (${migration.description}) failed: ${error.message}`;
      throw error;
    }
    current = migration.version;
  }
  return current;
}

function seed(db) {
  const insertSchool = db.prepare(
    `INSERT INTO schools (id, name, code, city, state, contact_name, contact_email, status, created_at, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAccount = db.prepare(
    `INSERT INTO accounts (id, name, email, password_hash, role, school_id, class_code, grade_level, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAttempt = db.prepare(
    `INSERT INTO attempts (id, student_id, experiment_code, seed, status, delivery, config_version, idempotency_key,
       started_at, submitted_at, rows_json, answers_json, graph_json, flags_json, notes, score_json, review_json, scenario_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN');
  try {
    for (const school of SCHOOLS) {
      insertSchool.run(
        school.id,
        school.name,
        school.code,
        school.city,
        school.state,
        school.contactName,
        school.contactEmail,
        school.status,
        school.createdAt,
        school.approvedAt,
      );
    }
    for (const [id, name, email, password, role, schoolId, classCode, gradeLevel, status, days] of ACCOUNTS) {
      insertAccount.run(
        id,
        name,
        email,
        hashPassword(password),
        role,
        schoolId,
        classCode,
        gradeLevel,
        status,
        daysAgo(days),
      );
    }
    let counter = 0;
    for (const [studentId, experimentCode, percent, days] of SEED_ATTEMPTS) {
      counter += 1;
      insertAttempt.run(
        `demo-attempt-${counter}`,
        studentId,
        experimentCode,
        1000 + counter * 97,
        'SCORED',
        'delivered',
        1,
        `idem_demo_${counter}`,
        daysAgo(days, 9),
        daysAgo(days),
        '[]',
        '{}',
        null,
        '{}',
        'Values read from the apparatus and processed as instructed.',
        JSON.stringify(demoScore(percent)),
        null,
        null,
      );
    }
    // Test assignments so both the teacher authoring and student views have content.
    const insertAssignment = db.prepare(
      `INSERT INTO assignments (id, teacher_id, school_id, class_code, title, experiment_code,
         instructions, due_at, params_json, questions_json, marking_guide, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertAssignment.run(
      'demo-assignment-1',
      'demo-teacher',
      'school-kcl',
      'SS2A-KCL',
      'Pendulum test: determine g',
      'PHY-01',
      'Run the pendulum at the amplitude set for you, record five lengths and submit your report. Show the gradient method clearly.',
      daysAgo(-3, 16),
      JSON.stringify({ amplitudeDeg: 7.5 }),
      '[]',
      '',
      'TEACHER',
      daysAgo(1, 8),
    );
    insertAssignment.run(
      'demo-assignment-2',
      'demo-teacher',
      'school-kcl',
      'SS2A-KCL',
      'WAEC skills: titration precision',
      'CHM-01',
      'Complete the titration with the base concentration fixed below, then answer the four written questions.',
      daysAgo(-5, 16),
      JSON.stringify({ analyteMolarity: 0.12 }),
      JSON.stringify([
        {
          id: 'q1',
          prompt: 'Explain why the burette must be rinsed with the acid before it is filled.',
          marks: 3,
          markingGuide: 'Removes water so the acid is not diluted; ensures the concentration on the label is the concentration delivered.',
        },
        {
          id: 'q2',
          prompt: 'State two precautions that improve the accuracy of the end-point.',
          marks: 4,
          markingGuide: 'Add dropwise near the end-point; swirl continuously; read the bottom of the meniscus at eye level; use a white tile.',
        },
        {
          id: 'q3',
          prompt: 'Why are concordant titres used rather than a single reading?',
          marks: 3,
          markingGuide: 'Concordant values show random error is small, so the mean is a more reliable estimate.',
        },
        {
          id: 'q4',
          prompt: 'Calculate the moles of acid in one average titre, using the concentration printed on the bench.',
          marks: 5,
          markingGuide: 'n = cV/1000 with the student’s average titre; marks for the substitution, the correct conversion to dm³ and the final unit.',
        },
      ]),
      'Award method marks for correct formulae even where arithmetic slips. The report rubric also marks the readings and calculation.',
      'AI',
      daysAgo(1, 9),
    );

    // One submission already marked by the teacher so the workflow is visible.
    const reviewed = db
      .prepare(
        `SELECT id, score_json FROM attempts WHERE student_id = ? AND experiment_code = ? LIMIT 1`,
      )
      .get('demo-student', 'PHY-08');
    if (reviewed) {
      db.prepare('UPDATE attempts SET review_json = ? WHERE id = ?').run(
        JSON.stringify({
          reviewerId: 'demo-teacher',
          reviewerName: 'Mr. Bello',
          marks: 32,
          comment:
            'Accurate readings and a clean best-fit line. Repeat the gradient triangle with a wider span next time.',
          reviewedAt: daysAgo(7, 14),
        }),
        reviewed.id,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createDatabase(filePath) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec(SCHEMA);
  migrate(db);
  // Indexes come after the migrations: they may reference columns that older
  // databases only gain in the migration above.
  db.exec(INDEXES);
  const row = db.prepare('SELECT COUNT(*) AS count FROM schools').get();
  if (Number(row.count) === 0) seed(db);
  return db;
}

export function resetDatabaseFile(filePath) {
  if (filePath !== ':memory:' && fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
  const wal = `${filePath}-wal`;
  const shm = `${filePath}-shm`;
  if (fs.existsSync(wal)) fs.rmSync(wal, { force: true });
  if (fs.existsSync(shm)) fs.rmSync(shm, { force: true });
}

export { gradeFor, makeId, now, SCHEMA_VERSION };
