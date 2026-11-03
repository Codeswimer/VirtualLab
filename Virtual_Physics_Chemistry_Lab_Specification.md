# Virtual Physics & Chemistry Laboratory
### Technical Specification and Developer Guide

| | |
|---|---|
| **Document ID** | VLAB-SPEC-001 |
| **Version** | 0.2.0 (draft, supersedes the unversioned README) |
| **Status** | Draft for review |
| **Owner** | _TBD (assign a technical owner and a curriculum owner)_ |
| **Last updated** | 2026-10-23 |
| **Audience** | Software engineers, simulation developers, 3D artists, QA, curriculum reviewers |

**Summary.** A browser-based 3D laboratory for Physics and Chemistry practical preparation at Senior Secondary level (SS1–SS3) in Nigeria. It is designed against the NERDC curriculum and the practical papers of WAEC (WASSCE) and NECO, and it must run on low-end hardware and unreliable networks. This document specifies requirements, architecture, simulation models, data model, API, security, testing and delivery. Appendix A holds the curriculum reference that the simulations and scoring rules are derived from.

> **Disclaimer.** This project is not affiliated with or endorsed by NERDC, WAEC, NECO or JAMB. "Aligned" means designed with reference to publicly available syllabi; alignment must be validated by a qualified curriculum reviewer (see Appendix B).

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Requirements](#2-requirements)
3. [Module Catalogue](#3-module-catalogue)
4. [System Architecture](#4-system-architecture)
5. [Getting Started](#5-getting-started)
6. [Simulation Engines](#6-simulation-engines)
7. [3D Asset Pipeline](#7-3d-asset-pipeline)
8. [Data Model](#8-data-model)
9. [API Specification](#9-api-specification)
10. [Security and Privacy](#10-security-and-privacy)
11. [Offline and Low-Bandwidth Strategy (PWA)](#11-offline-and-low-bandwidth-strategy-pwa)
12. [Testing and Quality Assurance](#12-testing-and-quality-assurance)
13. [CI/CD, Release and Operations](#13-cicd-release-and-operations)
14. [Risks](#14-risks)
15. [Contributing and Licensing](#15-contributing-and-licensing)
- [Appendix A: Curriculum Reference](#appendix-a-curriculum-reference)
- [Appendix B: Open Items and Claims to Verify](#appendix-b-open-items-and-claims-to-verify)
- [Appendix C: Revision History](#appendix-c-revision-history)

---

## 1. Introduction

### 1.1 Purpose

Many Nigerian secondary schools lack the apparatus, reagents or electricity needed to give every student enough hands-on practice before the practical papers. This platform lets students rehearse the same procedures (reading instruments, collecting data, plotting graphs, writing observations and inferences) in a simulated laboratory, with automatic marking against examination-style conventions.

### 1.2 Scope

**In scope**

- Interactive 3D and 2D simulations of the practicals listed in [Section 3](#3-module-catalogue).
- Structured data-entry tables, a graph-plotting tool, and server-side auto-scoring.
- Student and teacher accounts, progress tracking, and class-level results for teachers.
- Offline use after first load, with deferred submission.

**Out of scope (v1)**

- Replacing hands-on practicals in formal examinations.
- VR/AR headsets and native mobile apps.
- Live proctored examinations and video conferencing.
- Reproducing past examination questions or official marking schemes without written permission.

### 1.3 Note on examination bodies

WAEC and NECO assess hands-on practical papers. JAMB UTME is a computer-based objective test and does not include a hands-on laboratory paper, although it can include questions on practical knowledge. The platform therefore targets WAEC and NECO practical papers directly and JAMB practical-knowledge questions indirectly. (The original README listed all three as practical examinations; see Appendix B, item 2.)

### 1.4 Definitions

| Term | Meaning |
|---|---|
| NERDC | Nigerian Educational Research and Development Council (national curriculum body) |
| WAEC / WASSCE | West African Examinations Council / West African Senior School Certificate Examination |
| NECO | National Examinations Council |
| JAMB / UTME | Joint Admissions and Matriculation Board / Unified Tertiary Matriculation Examination |
| Titre | Volume of titrant delivered from the burette at the end-point (cm³) |
| Concordant titres | Titres agreeing within a stated tolerance (see Appendix A.6) |
| Least count | Smallest division an instrument can resolve |
| PWA | Progressive Web App (installable, offline-capable web application) |
| GLB | Binary glTF 3D asset format |
| Draco | Open-source geometry compression library used with glTF |
| ADR | Architecture Decision Record |
| NDPA | Nigeria Data Protection Act 2023 |

---

## 2. Requirements

Requirement IDs are stable and referenced from tests and pull requests. Numeric targets marked _(proposed)_ are engineering starting points and must be confirmed with stakeholders and measured on the reference device.

### 2.1 Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | A student can select an experiment and complete it end-to-end in the browser. |
| FR-02 | Simulated instruments return readings with realistic behaviour: least count, optional zero error, and random reading noise (Section 6.1). |
| FR-03 | Students record readings in structured tables that validate against examination conventions (decimal places, units, burette precision). |
| FR-04 | A graph tool supports axis labelling with units, scale selection, point plotting, a best-fit line and a gradient triangle. |
| FR-05 | Submissions are scored **on the server** against a configurable rubric, and the student receives itemised feedback. |
| FR-06 | Teachers can view submissions and aggregate results for their school or class. |
| FR-07 | Previously loaded experiments work offline; submissions made offline are queued and delivered exactly once when connectivity returns. |
| FR-08 | Experiment parameters (for example unknown concentrations or resistances) are generated from a per-attempt seed so that students do not share identical answers. |

### 2.2 Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | Initial app shell ≤ 3 MB compressed; each experiment's additional assets ≤ 5 MB _(proposed)_. |
| NFR-02 | Performance | ≥ 30 fps on the reference low-end device (define in `docs/reference-device.md`; for example 4 GB RAM, integrated GPU) _(proposed)_. |
| NFR-03 | Compatibility | Latest two major versions of Chrome, Edge, Firefox and Safari, plus Chrome on Android; WebGL 2 required, with a clear message and fallback page when unavailable. |
| NFR-04 | Accessibility | WCAG 2.2 AA for all non-canvas UI; colour is never the only signal (for example indicator colour changes are also described in text); full keyboard operation of data entry; respect `prefers-reduced-motion`. |
| NFR-05 | Security | OWASP ASVS Level 1 as baseline _(proposed)_; see Section 10. |
| NFR-06 | Privacy | Compliance review against the NDPA 2023 before launch; data minimisation for minors. |
| NFR-07 | Accuracy | Simulation outputs match documented analytic references within the tolerances in Section 12.2. |
| NFR-08 | Reliability | Define SLOs for API availability and submission-delivery success before launch; no submission may be lost or double-counted. |
| NFR-09 | Maintainability | TypeScript `strict` mode; linting and formatting enforced in CI; ≥ 90 % line coverage on `sim-core`, ≥ 70 % elsewhere _(proposed)_. |

---

## 3. Module Catalogue

The original README and its curriculum section listed different sets of experiments. This catalogue reconciles them. **Source** shows where each module was mentioned; modules that appear only in the README need curriculum confirmation before build (Appendix B, item 5). **Priority** is proposed.

### 3.1 Physics

| ID | Module | Simulation approach | Source | Priority |
|---|---|---|---|---|
| PHY-01 | Simple pendulum ($T^2$ vs $L$, determine $g$) | Rapier visual + analytic/ODE reference | Both | P0 |
| PHY-02 | Hooke's law (spring constant) | Analytic | Appendix A | P1 |
| PHY-03 | Principle of moments, centre of gravity of a metre rule | Analytic + rigid-body visual | Appendix A | P1 |
| PHY-04 | Density and relative density (Archimedes) | Analytic | Appendix A | P1 |
| PHY-05 | Concurrent forces (force board) | Vector solver | Appendix A | P2 |
| PHY-06 | Inclined-plane friction | Rapier (friction model) | README only | P2 |
| PHY-07 | Vernier callipers and micrometer screw gauge (reading skills) | Instrument model | README only | P0 |
| PHY-08 | Refraction through a rectangular glass block ($n$; real/apparent depth) | Analytic ray tracing | Both | P0 |
| PHY-09 | Triangular prism (minimum deviation, dispersion) | Analytic ray tracing | Both | P1 |
| PHY-10 | Converging lens and concave mirror (focal length) | Analytic ray optics | Both | P1 |
| PHY-11 | Ohm's law; series/parallel circuit building | Nodal-analysis circuit solver | Both | P0 |
| PHY-12 | Metre bridge / Wheatstone principle | Analytic | Both | P1 |
| PHY-13 | Potentiometer ($E$, $r$) | Analytic | Both | P1 |
| PHY-14 | Specific heat capacity (method of mixtures) | Energy balance + heat-loss model | Appendix A | P1 |
| PHY-15 | Cooling curves, linear expansion | Newton's law of cooling (ODE) | Appendix A | P2 |
| PHY-16 | Boyle's and Charles's laws | Analytic | README only | P2 |

### 3.2 Chemistry

| ID | Module | Simulation approach | Source | Priority |
|---|---|---|---|---|
| CHM-01 | Acid–base titration (HCl vs NaOH; HCl vs Na₂CO₃) | Equilibrium solver (Section 6.3) | Both | P0 |
| CHM-02 | Hydrate, purity and molar-mass titration calculations | Stoichiometry on the CHM-01 engine | Appendix A | P1 |
| CHM-03 | Redox titrations (KMnO₄; iodine/thiosulfate) | Stoichiometric, self-indicating end-point | Appendix A | P1 |
| CHM-04 | Cation identification | Data-driven rule table | Both | P0 |
| CHM-05 | Anion and gas identification | Data-driven rule table | Both | P0 |
| CHM-06 | Food tests and organic functional groups | Data-driven rule table | Appendix A | P2 |

---

## 4. System Architecture

### 4.1 Overview

```mermaid
flowchart TB
  subgraph Client["Browser / PWA"]
    UI["React UI + Zustand state"]
    R3F["Three.js via React Three Fiber"]
    CORE["sim-core: pure TypeScript solvers"]
    RAP["Rapier (WASM): rigid bodies only"]
    SW["Service Worker (Workbox)"]
  end
  subgraph Server["Backend"]
    API["NestJS REST API"]
    SCORE["Scoring service"]
  end
  PG[("PostgreSQL")]
  RD[("Redis")]
  UI --> R3F --> RAP
  UI --> CORE
  UI <--> SW <--> API
  API --> SCORE
  SCORE --> CORE
  API --> PG
  API --> RD
```

The same `sim-core` package runs in the browser (to drive the simulation) and on the server (to recompute expected values for scoring), so the two cannot drift apart.

### 4.2 Simulation strategy

Not every experiment is a rigid-body problem. Three tiers are used:

1. **Rigid-body physics (Rapier).** Used only where bodies move and collide: pendulum swing, sliding on an incline, metre-rule balancing. This tier drives what the student *sees*.
2. **Analytic and ODE solvers (`sim-core`).** Optics, circuits, thermal physics, gas laws and chemistry are computed from equations.
3. **Rule tables.** Qualitative analysis (cations, anions, gases, food tests) is stored as **data** (JSON validated by a schema), not hard-coded `if` statements, so curriculum reviewers can audit and edit rules without touching code.

> **Design rule.** Quantities that students *measure and record* come from tier 2 plus the measurement model (Section 6.1), never from values read out of the render loop. This keeps results independent of frame rate and makes them reproducible from a seed.

### 4.3 Technology stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend UI | React 18, TypeScript (strict), TailwindCSS | Component model for HUD, tables, graph overlay and experiment selection. |
| 3D rendering | Three.js via `@react-three/fiber` and `@react-three/drei` | Declarative scenes. Use R3F v8 with React 18 (R3F v9 targets React 19); pin versions. |
| Rigid-body physics | `@react-three/rapier` (Rapier, WASM) | Fast, deterministic collision and joint simulation. |
| Shared engine | `packages/sim-core` (pure TypeScript) | No DOM or Three.js dependency; shared by client and server. |
| 3D formats | glTF/GLB with Draco (geometry) and WebP or KTX2 (textures) | Small downloads (Section 7). |
| Backend | Node.js with NestJS | Modular structure, built-in validation and OpenAPI support. |
| Database | PostgreSQL 15+ (16 recommended) with Prisma ORM | Relational integrity for users, experiments and marks. |
| Cache / sessions | Redis; Zustand on the client | Fast session and rate-limit state; lightweight client state. |
| Offline | `vite-plugin-pwa` (Workbox) | Service worker, caching, background sync. |
| Unit / integration tests | Vitest (frontend, `sim-core`), Jest (NestJS default) | Vitest is Vite-native; either is acceptable if used consistently. |
| End-to-end tests | Playwright | Cross-browser canvas and UI tests. |

### 4.4 Architecture decisions

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | **NestJS + Prisma** is the backend. The original offered "NestJS **or** FastAPI", but Prisma is a Node.js ORM and the two choices are incompatible. Python is removed from prerequisites. Reverse only with a full re-evaluation. | Proposed |
| ADR-002 | Measured quantities come from analytic/ODE solvers; Rapier drives visuals only (Section 4.2). | Proposed |
| ADR-003 | Scoring is computed **server-side**; the client never submits a score. | Proposed |
| ADR-004 | Draco decoder files are **self-hosted** so that 3D assets load offline (Section 7.3). | Proposed |
| ADR-005 | PWA update mode is `prompt`, not `autoUpdate`, so the app never reloads in the middle of a practical (Section 11). | Proposed |
| ADR-006 | Qualitative-analysis rules live in schema-validated data files, not code. | Proposed |

Each accepted decision is recorded as a short file in `docs/adr/` using the standard Context / Decision / Consequences format.

### 4.5 Repository layout

The original used independent `frontend/` and `backend/` installs. A pnpm workspace is recommended so that `sim-core` can be shared.

```text
virtual-lab-nigeria/
├── .github/workflows/ci.yml
├── .nvmrc                        # pinned Node.js version
├── docker-compose.yml            # local PostgreSQL + Redis
├── package.json                  # "packageManager" field pins pnpm
├── pnpm-workspace.yaml
├── packages/
│   └── sim-core/                 # pure TS, shared by client and server
│       └── src/
│           ├── chemistry/        # TitrationMath.ts, ionic equilibria, stoichiometry
│           ├── physics/          # PendulumSolver.ts, CircuitSolver.ts, optics
│           ├── measurement/      # instrument least-count / noise model
│           ├── rules/            # JSON rule tables + schema (cations, anions, gases)
│           └── scoring/          # rubric engine
├── frontend/
│   ├── public/
│   │   ├── draco/                # self-hosted Draco decoder (Section 7.3)
│   │   └── assets/models/        # compressed .glb files
│   └── src/
│       ├── components/
│       │   ├── 3d/
│       │   │   ├── apparatus/    # Caliper.tsx, Burette.tsx, Pendulum.tsx
│       │   │   ├── environment/  # LabRoom.tsx, Lighting.tsx, Workbench.tsx
│       │   │   └── LabCanvas.tsx
│       │   └── ui/               # HUD, data tables, graph tool, titration controls
│       ├── stores/               # Zustand stores
│       └── App.tsx
├── backend/
│   ├── prisma/                   # schema.prisma, migrations, seed
│   └── src/modules/
│       ├── auth/
│       ├── experiments/
│       ├── submissions/          # includes scoring
│       └── analytics/
├── docs/
│   ├── adr/                      # architecture decision records
│   ├── reference-device.md
│   └── THIRD_PARTY_LICENSES.md
└── scripts/                      # asset budget checks, tooling
```

---

## 5. Getting Started

### 5.1 Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS or 24 LTS | Pinned in `.nvmrc`. Node 18 reached end-of-life in April 2025 and Node 20 in April 2026; check [nodejs.org](https://nodejs.org/en/about/previous-releases) for current status. |
| pnpm | 9+ | Enable with `corepack enable`; the exact version is pinned in the root `package.json` (`packageManager`). |
| Docker with Compose v2 | Current | Runs PostgreSQL 16 and Redis 7 locally. Native installs also work. |
| Blender | 3.6 LTS or newer | Only needed to edit or export 3D assets. |
| Browser | WebGL 2 capable | Integrated or discrete GPU. |

### 5.2 Install

```bash
git clone https://github.com/your-org/virtual-lab-nigeria.git
cd virtual-lab-nigeria
nvm use            # reads .nvmrc
corepack enable
pnpm install       # installs every workspace package
```

### 5.3 Start local services

```yaml
# docker-compose.yml (local development only; do not reuse these credentials)
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: virtuallab
    ports: ["127.0.0.1:5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d virtuallab"]
      interval: 5s
      timeout: 3s
      retries: 10
  redis:
    image: redis:7
    ports: ["127.0.0.1:6379:6379"]
volumes:
  pgdata:
```

```bash
docker compose up -d
```

### 5.4 Environment configuration

Copy each example file; **never commit `.env` files**. Only `*.env.example` files are tracked.

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example  backend/.env
```

`frontend/.env.example`

```ini
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_ENABLE_ANALYTICS=false
# VITE_* variables are embedded in the public bundle. Never put secrets here.
```

`backend/.env.example`

```ini
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://postgres:devpassword@localhost:5432/virtuallab?schema=public"
REDIS_URL="redis://localhost:6379"
# Generate each secret with: openssl rand -base64 48
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

The backend must **fail at start-up** if a required variable is missing or still empty (validate configuration with a schema). In production, secrets come from the hosting platform's secret store, not from files.

### 5.5 Database

```bash
pnpm --filter backend exec prisma migrate dev --name init
pnpm --filter backend exec prisma db seed      # requires the "prisma.seed" entry in backend/package.json
```

Use `prisma migrate deploy` (not `migrate dev`) in staging and production.

### 5.6 Run

```bash
pnpm --filter backend  start:dev     # API on :4000
pnpm --filter frontend dev           # app on http://localhost:5173
```

---

## 6. Simulation Engines

### 6.1 Measurement model

Students must practise handling imperfect measurements, so every simulated instrument passes the true value through a measurement model:

```text
reading = round_to_least_count( true_value + zero_error + noise )
```

`zero_error` is optional and fixed per attempt (so students must detect and correct it); `noise` is zero-mean random error drawn from a seeded generator (so the same seed reproduces the same readings). Typical defaults, all configurable per experiment:

| Instrument | Typical least count | Recording convention |
|---|---|---|
| Metre rule | 0.1 cm | Nearest 0.1 cm |
| Vernier callipers | 0.01 cm | 2 decimal places (cm) |
| Micrometer screw gauge | 0.01 mm | 2 decimal places (mm) |
| Stopwatch | 0.1 s (analogue) or 0.01 s (digital) | As displayed |
| Burette | 0.1 cm³ graduations | 2 decimal places, last digit 0 or 5 |
| Thermometer (0–110 °C) | 1 °C graduations | Nearest 0.5 °C |
| Ammeter / voltmeter | Set by scale | Nearest half-division |

### 6.2 Physics: simple pendulum

Rapier animates the swing. The timing values the student records come from the analytic period (with finite-amplitude correction) plus the measurement model, per the design rule in Section 4.2. Corrections to the original sample:

- The bob is **released from an angle**. In the original it hung at rest and would never move.
- The joint anchor on the bob is computed from the release angle (the original's fixed `[0, length, 0]` is only valid when the bob hangs vertically).
- `length` is measured from the pivot to the **centre** of the bob, matching examination practice.
- Unused imports are removed, and `angularDamping` is set explicitly.

```tsx
// frontend/src/components/3d/apparatus/Pendulum.tsx
import { useRef } from 'react';
import {
  RigidBody,
  useSphericalJoint,
  type RapierRigidBody,
} from '@react-three/rapier';

export interface PendulumProps {
  /** Pivot-to-bob-centre distance in metres. */
  lengthM: number;
  bobMassKg?: number;
  bobRadiusM?: number;
  /** Release angle from the vertical, in degrees. Keep <= 10 for the small-angle regime. */
  releaseAngleDeg?: number;
  pivot?: [number, number, number];
}

/** Must be rendered inside a <Physics> provider. */
export function Pendulum({
  lengthM,
  bobMassKg = 0.05,
  bobRadiusM = 0.0125,
  releaseAngleDeg = 5,
  pivot = [0, 2, 0],
}: PendulumProps) {
  const anchorRef = useRef<RapierRigidBody>(null);
  const bobRef = useRef<RapierRigidBody>(null);

  const theta = (releaseAngleDeg * Math.PI) / 180;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);

  // Bob centre at release; vector from bob centre back to the pivot (bob's local frame).
  const bobPosition: [number, number, number] = [
    pivot[0] + lengthM * sin,
    pivot[1] - lengthM * cos,
    pivot[2],
  ];
  const pivotInBobFrame: [number, number, number] = [-lengthM * sin, lengthM * cos, 0];

  useSphericalJoint(anchorRef, bobRef, [[0, 0, 0], pivotInBobFrame]);

  return (
    <group>
      <RigidBody ref={anchorRef} type="fixed" position={pivot}>
        <mesh>
          <sphereGeometry args={[0.01]} />
          <meshStandardMaterial color="black" />
        </mesh>
      </RigidBody>

      <RigidBody
        ref={bobRef}
        position={bobPosition}
        mass={bobMassKg}
        linearDamping={0.01}
        angularDamping={0.01}
      >
        <mesh castShadow>
          <sphereGeometry args={[bobRadiusM]} />
          <meshStandardMaterial color="gold" metalness={0.8} roughness={0.2} />
        </mesh>
      </RigidBody>
    </group>
  );
}
```

Use a fixed physics time step (for example `<Physics timeStep={1 / 120}>`) so the visual period does not depend on frame rate. An automated test (Section 12.2) checks that the simulated period stays within 1 % of the analytic value.

### 6.3 Chemistry: titration engine

**Why the original was replaced.** The original `calculateTitrationPH` treated every case as strong acid + strong base with a 1:1 ratio, which is wrong for HCl + Na₂CO₃:

- Na₂CO₃ reacts with **two** moles of HCl per mole (it has two protonation stages).
- The end-point is **not** at pH 7. With methyl orange the end-point is at about pH 3.9 (carbonic acid stage); the first equivalence point is at about pH 8.3.
- The `Math.abs(excessBase) < 1e-7` test for the equivalence point used an absolute tolerance that breaks at other concentrations.
- `interpolateColor` was a stub that always returned the same colour.

**Model.** Both solvers use the exact charge balance for the mixture at 25 °C (ideal solution, activity coefficients ignored).

Strong acid into strong base, with $K_w = 10^{-14}$:

$$[\mathrm{H^+}] - \frac{K_w}{[\mathrm{H^+}]} = \frac{n_{\mathrm{acid}} - n_{\mathrm{base}}}{V_{\mathrm{total}}}$$

This is a quadratic with one positive root, so there is no branch at equivalence and the curve is continuous.

Hydrochloric acid into sodium carbonate, with total carbonate $C_T$:

$$[\mathrm{Na^+}] + [\mathrm{H^+}] = [\mathrm{OH^-}] + [\mathrm{Cl^-}] + [\mathrm{HCO_3^-}] + 2[\mathrm{CO_3^{2-}}]$$

with $[\mathrm{HCO_3^-}] = C_T\,\alpha_1$ and $[\mathrm{CO_3^{2-}}] = C_T\,\alpha_2$, where $\alpha_1 = \dfrac{K_{a1}h}{h^2 + K_{a1}h + K_{a1}K_{a2}}$ and $\alpha_2 = \dfrac{K_{a1}K_{a2}}{h^2 + K_{a1}h + K_{a1}K_{a2}}$, $h=[\mathrm{H^+}]$. The residual is monotonic in pH, so bisection always converges to the unique root.

```ts
// packages/sim-core/src/chemistry/TitrationMath.ts

/** Ionic product of water at 25 °C. */
export const KW_25C = 1.0e-14;
/** Carbonic acid dissociation constants at 25 °C (zero ionic strength). */
export const KA1_CARBONIC = 4.45e-7;
export const KA2_CARBONIC = 4.69e-11;

export interface Solution {
  /** Volume in cm³ (equal to mL). */
  volumeCm3: number;
  /** Concentration in mol/dm³. */
  molarity: number;
}

const cm3ToDm3 = (v: number): number => v / 1000;

function assertValid(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) {
    throw new RangeError(`${name} must be a finite number >= 0 (received ${v})`);
  }
}

/**
 * pH after adding `addedCm3` of a strong monoprotic acid (titrant) to a strong
 * monoprotic base (analyte). Solves [H+] - Kw/[H+] = net excess strong-ion concentration.
 * The two algebraic forms avoid catastrophic cancellation when the base is in excess.
 */
export function pHStrongAcidStrongBase(
  titrant: Solution,
  analyte: Solution,
  addedCm3: number,
  kw: number = KW_25C,
): number {
  assertValid('titrant.molarity', titrant.molarity);
  assertValid('analyte.molarity', analyte.molarity);
  assertValid('analyte.volumeCm3', analyte.volumeCm3);
  assertValid('addedCm3', addedCm3);

  const vTotal = cm3ToDm3(analyte.volumeCm3 + addedCm3);
  const net =
    (titrant.molarity * cm3ToDm3(addedCm3) -
      analyte.molarity * cm3ToDm3(analyte.volumeCm3)) /
    vTotal; // > 0: excess acid, < 0: excess base
  const root = Math.sqrt(net * net + 4 * kw);
  const h = net >= 0 ? (net + root) / 2 : (2 * kw) / (root - net);
  return -Math.log10(h);
}

/**
 * pH after adding `addedCm3` of strong acid (e.g. HCl) to aqueous Na2CO3.
 * Closed-system model: dissolved CO2 stays in solution. Boiling off CO2 near the
 * end-point (as in some practical procedures) raises the observed pH slightly.
 */
export function pHCarbonateWithStrongAcid(
  titrant: Solution,
  analyte: Solution,
  addedCm3: number,
  constants: { kw?: number; ka1?: number; ka2?: number } = {},
): number {
  const { kw = KW_25C, ka1 = KA1_CARBONIC, ka2 = KA2_CARBONIC } = constants;
  assertValid('titrant.molarity', titrant.molarity);
  assertValid('analyte.molarity', analyte.molarity);
  assertValid('analyte.volumeCm3', analyte.volumeCm3);
  assertValid('addedCm3', addedCm3);

  const vTotal = cm3ToDm3(analyte.volumeCm3 + addedCm3);
  const totalCarbonate = (analyte.molarity * cm3ToDm3(analyte.volumeCm3)) / vTotal;
  const sodium = 2 * totalCarbonate;
  const chloride = (titrant.molarity * cm3ToDm3(addedCm3)) / vTotal;

  // Charge-balance residual; strictly decreasing in pH, so bisection is safe.
  const residual = (pH: number): number => {
    const h = Math.pow(10, -pH);
    const d = h * h + ka1 * h + ka1 * ka2;
    const negativeCarbonate = (totalCarbonate * (ka1 * h + 2 * ka1 * ka2)) / d;
    return sodium + h - kw / h - chloride - negativeCarbonate;
  };

  let lo = -2;
  let hi = 16;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (residual(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

type RGBA = readonly [r: number, g: number, b: number, a: number];

export interface IndicatorSpec {
  name: string;
  transitionStartPH: number;
  transitionEndPH: number;
  lowPHColor: RGBA;
  highPHColor: RGBA;
}

export const METHYL_ORANGE: IndicatorSpec = {
  name: 'Methyl orange',
  transitionStartPH: 3.1,
  transitionEndPH: 4.4,
  lowPHColor: [255, 0, 0, 1],    // red
  highPHColor: [255, 255, 0, 1], // yellow
};

export const PHENOLPHTHALEIN: IndicatorSpec = {
  name: 'Phenolphthalein',
  transitionStartPH: 8.2,
  transitionEndPH: 10.0,
  lowPHColor: [255, 255, 255, 0], // colourless
  highPHColor: [255, 0, 128, 1],  // pink / magenta
};

/** CSS rgba() colour of an indicator at a given pH (linear blend across its transition range). */
export function indicatorColor(spec: IndicatorSpec, pH: number): string {
  const span = spec.transitionEndPH - spec.transitionStartPH;
  const t = Math.min(1, Math.max(0, (pH - spec.transitionStartPH) / span));
  const [r, g, b, a] = spec.lowPHColor.map(
    (low, i) => low + (spec.highPHColor[i] - low) * t,
  );
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
}

// ---------------------------------------------------------------------------
// Examination-convention helpers (used by the scoring engine)
// ---------------------------------------------------------------------------

/** Burette readings: 0–50 cm³, two decimal places, final digit 0 or 5 (e.g. 12.35). */
export function isValidBuretteReading(reading: number): boolean {
  const hundredths = Math.round(reading * 100);
  return (
    reading >= 0 &&
    reading <= 50 &&
    Math.abs(reading * 100 - hundredths) < 1e-6 &&
    hundredths % 5 === 0
  );
}

/**
 * Largest group of titres whose spread is within `toleranceCm3`, and their mean.
 * Returns null if fewer than two titres are concordant.
 * The tolerance (0.10 or 0.20 cm³) varies by board and year, so it is a parameter.
 */
export function concordantMean(
  titres: readonly number[],
  toleranceCm3 = 0.2,
): { titres: number[]; mean: number } | null {
  const sorted = [...titres].sort((a, b) => a - b);
  let best: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] - sorted[i] <= toleranceCm3 + 1e-9) j++;
    if (j - i + 1 > best.length) best = sorted.slice(i, j + 1);
  }
  if (best.length < 2) return null;
  return { titres: best, mean: best.reduce((s, t) => s + t, 0) / best.length };
}
```

**Stoichiometry reference** (used by CHM-01 to CHM-03; ratio is first reactant : second reactant):

| Reaction | Balanced equation | Mole ratio | End-point detection |
|---|---|---|---|
| HCl + NaOH | $\mathrm{HCl + NaOH \rightarrow NaCl + H_2O}$ | 1 : 1 | Methyl orange or phenolphthalein |
| HCl + Na₂CO₃ | $\mathrm{2HCl + Na_2CO_3 \rightarrow 2NaCl + H_2O + CO_2}$ | 2 : 1 | Methyl orange (phenolphthalein only marks the first stage, giving NaHCO₃) |
| H₂SO₄ + NaOH | $\mathrm{H_2SO_4 + 2NaOH \rightarrow Na_2SO_4 + 2H_2O}$ | 1 : 2 | Methyl orange or phenolphthalein |
| MnO₄⁻ + Fe²⁺ | $\mathrm{MnO_4^- + 8H^+ + 5Fe^{2+} \rightarrow Mn^{2+} + 5Fe^{3+} + 4H_2O}$ | 1 : 5 | Self-indicating: first permanent pink |
| MnO₄⁻ + H₂C₂O₄ | $\mathrm{2MnO_4^- + 5H_2C_2O_4 + 6H^+ \rightarrow 2Mn^{2+} + 10CO_2 + 8H_2O}$ | 2 : 5 | Self-indicating; solution is warmed |
| I₂ + S₂O₃²⁻ | $\mathrm{I_2 + 2S_2O_3^{2-} \rightarrow 2I^- + S_4O_6^{2-}}$ | 1 : 2 | Starch added near the end-point (blue-black to colourless) |

**Model limits (document in the UI help):** 25 °C; ideal solutions; strong monoprotic acids and bases and sodium carbonate only. Weak acids (for example ethanoic acid) and diprotic acids need extensions before use. NaOH is not a primary standard (it absorbs water and CO₂), so exercises that "standardise" NaOH should do so against a primary standard such as Na₂CO₃.

---

## 7. 3D Asset Pipeline

### 7.1 Budgets

Budgets are proposed starting values; validate them on the reference device and enforce them in CI (`scripts/check-assets.ts`, to be implemented).

| Item | Budget |
|---|---|
| Triangles per apparatus | ≤ 15,000 (the original said "polygons"; use triangles, which is what the GPU renders) |
| Triangles per scene | ≤ 150,000 |
| Draw calls per scene | ≤ 100 |
| Texture size | 1024 × 1024 by default; 2048 × 2048 only for hero pieces, packed PBR (ORM) maps |
| Compressed `.glb` per apparatus | ≤ 500 KB |
| Total assets per experiment | ≤ 5 MB |

### 7.2 Workflow

1. Model in Blender; apply transforms, merge materials, remove hidden geometry.
2. Export as binary glTF (`.glb`).
3. Optimise with `gltf-transform`.
4. Content-hash the file name (for example `burette_stand.3f9a1c.glb`) so long-lived caches are safe to update.

The original command (`--draco.method`, `--draco.quantizePosition`) does not match the `optimize` command's options. Use:

```bash
npm install -g @gltf-transform/cli      # or: pnpm dlx @gltf-transform/cli ...

gltf-transform optimize burette_stand.glb burette_stand.min.glb \
  --compress draco \
  --texture-compress webp \
  --texture-size 1024

gltf-transform inspect burette_stand.min.glb    # record size and triangle counts in the PR
```

WebP reduces download size but textures are still fully decompressed in GPU memory. On very low-end devices prefer KTX2/Basis textures (`--texture-compress ktx2`, requires the `toktx` tool), which stay compressed on the GPU. The original claim that Draco "shrinks asset sizes by 70–85 %" depends heavily on the asset; record actual before/after sizes instead of relying on a general figure.

### 7.3 Self-host the Draco decoder

By default `useGLTF` fetches the Draco decoder from a public CDN. That fails offline and on restricted school networks. Copy the decoder files from `three/examples/jsm/libs/draco/gltf/` into `frontend/public/draco/` and point the loader at them:

```ts
import { useGLTF } from '@react-three/drei';

useGLTF.setDecoderPath('/draco/');
```

---

## 8. Data Model

### 8.1 Entity relationships

```mermaid
erDiagram
  School ||--o{ User : employs_or_enrols
  User ||--o{ LabSubmission : makes
  Experiment ||--o{ LabSubmission : receives
```

### 8.2 Prisma schema

Syntax shown is for Prisma 5/6. Prisma 7 and later moves the connection URL to `prisma.config.ts`; pin the Prisma version in `package.json` and follow its upgrade guide when upgrading.

```prisma
// backend/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  STUDENT
  TEACHER
  ADMIN
}

enum Subject {
  PHYSICS
  CHEMISTRY
}

enum ExamBody {
  WAEC
  NECO
  JAMB
}

enum SubmissionStatus {
  IN_PROGRESS
  SUBMITTED
  SCORED
}

model School {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  state     String?  // Nigerian state
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([name, state])
}

model User {
  id             String          @id @default(uuid()) @db.Uuid
  email          String          @unique
  passwordHash   String          // argon2id
  fullName       String
  role           Role            @default(STUDENT)
  isActive       Boolean         @default(true)
  schoolId       String?         @db.Uuid
  school         School?         @relation(fields: [schoolId], references: [id], onDelete: SetNull)
  labSubmissions LabSubmission[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([schoolId])
}

model Experiment {
  id            String          @id @default(uuid()) @db.Uuid
  slug          String          @unique        // e.g. "chm-01-hcl-na2co3-titration"
  moduleCode    String                          // e.g. "CHM-01" (Section 3)
  title         String                          // e.g. "Determination of Acid-Base Titration End-point"
  subject       Subject
  examBodies    ExamBody[]
  configVersion Int             @default(1)
  config        Json                            // Starting values, tolerances, rubric reference
  isPublished   Boolean         @default(false)
  submissions   LabSubmission[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([subject, isPublished])
}

model LabSubmission {
  id               String           @id @default(uuid()) @db.Uuid
  userId           String           @db.Uuid
  experimentId     String           @db.Uuid
  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  experiment       Experiment       @relation(fields: [experimentId], references: [id], onDelete: Restrict)
  attempt          Int              @default(1)
  status           SubmissionStatus @default(IN_PROGRESS)
  seed             Int              // reproduces this attempt's randomised parameters
  configVersion    Int              // experiment config version used for this attempt
  readings         Json             // student-recorded tables
  score            Float?           // null until scored
  maxScore         Float?
  rubricBreakdown  Json?            // per-criterion marks and feedback
  feedback         String?
  idempotencyKey   String?          @unique
  startedAt        DateTime         @default(now())
  submittedAt      DateTime?

  @@unique([userId, experimentId, attempt])
  @@index([experimentId])
  @@index([userId, submittedAt])
}
```

### 8.3 Design notes

- **Enums replace free-text strings** for subject and examination body; an experiment can be relevant to several bodies (`examBodies` is an array).
- **Foreign-key columns are indexed** (Prisma does not create these indexes automatically on PostgreSQL).
- **Reproducibility.** `seed` and `configVersion` let the server regenerate the exact expected values for any past attempt, which is what makes server-side scoring auditable.
- **`score` is nullable** until the server has scored the submission; the client never supplies it.
- **`idempotencyKey`** prevents a queued offline submission from being counted twice when it is replayed.
- **`School` is a separate entity** (the original stored `schoolName` as a string on each user), which enables per-school teacher dashboards and avoids spelling variants.
- **Personal data** is limited to name, email and school. Add fields only with a documented purpose (Section 10.2).
