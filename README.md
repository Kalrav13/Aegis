# Aegis — AI-Powered QA Analyst Platform

Aegis is a monorepo platform that automates repository understanding, feature and scenario discovery, test case generation, test coverage intelligence, and execution performance analytics using agentic AI reasoning.

---

## 📂 Repository Structure

The project is structured as a TypeScript/Node monorepo using **NPM Workspaces** and managed with **Turborepo** for build optimization.

```
Aegis/
├── apps/
│   ├── api/                   # NestJS API backend (ingestion, analytics, processor, Gemini LLM connection)
│   └── web/                   # Next.js frontend (dashboards, feature coverage maps, execution reporting UI)
├── packages/
│   ├── contracts/             # Zod data schemas, validators, and shared TypeScript models
│   ├── database/              # Prisma schema declarations, database migrations, and client wrapper
│   └── typescript-config/     # Shared base tsconfig templates for NestJS and Next.js
├── package.json               # Monorepo setup and workspaces definition
└── turbo.json                 # Turborepo task pipeline configuration
```

---

## 🚀 Key Modules & Pipelines

1.  **Repository Intelligence (Part 1)**: Clones repositories, respects `.gitignore` rules, limits payload size, and structures file contents for LLM consumption.
2.  **Repository Understanding (Part 2)**: Builds codebase context registries and evaluates file context metrics.
3.  **Feature Discovery (Part 3)**: Discovers features in codebases, mapping feature structures.
4.  **Scenario Intelligence (Part 4)**: Maps functional workflows and scenarios, evaluating functional coverage targets.
5.  **Test Case Discovery (Part 5)**: Generates and deduplicates functional test cases with stable business keys (e.g., `TC-[FEATURE]-[SEQ]`).
6.  **Automation Generation (Part 6)**: Maps discovered test cases to playbooks and automated automation script templates.
7.  **Coverage Intelligence (Part 7)**: Compiles coverage metrics, mapping features to automated scripts.
8.  **Execution Intelligence Layer (Part 8)**: Validates execution results, retry rates, and runs analytics.

---

## ⚡ Part 8: Execution Intelligence Layer Architecture

The Execution Intelligence Layer analyzes testing logs, counts failures, isolates flakiness, maps diagnostic attachment availability, and scores build readiness.

```
       [Raw Results & Artifacts Ingest]
                      │
                      ▼
        [Zod Contracts Verification]  <-- execution.schema.ts
                      │
                      ▼
       [Execution Calculations Engine] <-- execution-intelligence.service.ts
         ├── Pass / Fail / Skip Rates
         ├── Retry & Flakiness Detection
         ├── Severity Mapping (Critical path detection)
         ├── Confidence Calculation (Sample-size gates)
         └── Readiness Evaluation
                      │
                      ▼
       [Execution Reporting Service]   <-- execution-reporting.service.ts
         ├── Executive Summaries & Recommendations
         ├── Flaky Test Maintenance Priority Ranker
         ├── 30-Day Stale Trend Guard
         └── Source Segments Analytics
                      │
                      ▼
       [Transaction-Safe Persistence]  <-- analysis.processor.ts
         └── Writes results, quality, and cached dashboard payload inside database transaction
                      │
                      ▼
          [Sub-Second REST API]        <-- analysis.controller.ts (GET /api/analysis/:id/execution-report)
```

### 1. Confidence Formula
TestLens computes an execution confidence score (0 to 100) reflecting run stability:
$$Confidence = 0.40 \times \text{Pass Rate} - 0.20 \times \text{Flaky Rate} + 0.20 \times \text{Automation Quality} + 0.10 \times (100 - \text{Retry Rate}) + 0.10 \times \text{Artifact Integrity}$$

*   **Minimum Sample Gate**: Capped at `80` if `totalTests < 20` to account for insufficient test suite volume.
*   **Critical Failure Override**: Capped at `GOOD` classification (never `EXCELLENT`) with logs warning users if any payment, auth, billing, or checkout path failures are detected.

### 2. Flaky Detection
*   **Retry Flakiness**: Triggers if `status === 'PASSED'` and `retryCount > 0`.
*   **Historical Flakiness**: Triggers if a test's status flips (PASSED $\leftrightarrow$ FAILED) across the last 5 completed runs.
*   **Duration Variance**: Triggers if duration coefficient of variation (Standard Deviation / Mean) $> 2.0$.

### 3. Flaky Maintenance Priority Score
Highlights test scripts that require developer stabilization:
$$\text{Priority} = \text{Flaky Rate} \times \text{Risk Factor} + \text{Duration Variance Ratio} \times 100$$
*(Risk factors: `CRITICAL` = 3.0, `HIGH` = 2.0, `MEDIUM` = 1.5, `LOW` = 1.0)*

### 4. Readiness Gates
Blocks release check validation if:
*   Pass Rate $< 95.0\%$
*   Flaky Rate $> 15.0\%$
*   `CRITICAL` severity failures detected.
*   Confidence Score $< 70.0\%$
*   Total tests in run $= 0$.

---

## 🛠️ Setup & Local Development

### 1. Prerequisites
*   Node.js (v18 or higher)
*   PostgreSQL Database instance

### 2. Environment Setup
Create a `.env` file in the root directory copying the contents of `.env.example`:
```env
DATABASE_URL="postgresql://user:password@localhost:5402/testlens?schema=public"
GEMINI_API_KEY="your-gemini-key"
```

### 3. Installation
Install all workspaces dependencies from the root directory:
```bash
npm install
```

### 4. Database Initialization
Generate the Prisma client and apply the migrations:
```bash
# Generate Prisma Client
npm run db:generate

# Deploy Migrations (or run prisma migrate dev)
npm run db:migrate
```

### 5. Running the Application
Start both the NestJS API server and the Next.js web application concurrently:
```bash
npm run dev
```
*   Backend API runs at: `http://localhost:3000`
*   Frontend Web Dashboard runs at: `http://localhost:3001`

---

## 🧪 Running Tests
To run unit and integration tests inside NestJS API workspace:
```bash
cd apps/api
npx jest
```
*(Spec files are excluded from default builds via tsconfig mappings).*
Minor update – timestamp: 2026-06-11T15:05Z
