# Task Checklist - Part 4 & Part 5

## Part 4.3: Scenario Discovery Agent
- `[x]` Update contracts package schema (`packages/contracts/src/scenario.schema.ts`) to add `coverageTargets` and `scenarioOrigin`
- `[x]` Update database schema (`packages/database/prisma/schema.prisma`) to add `scenarioOrigin` field to `Scenario`
- `[x]` Regenerate Prisma Client and compile database package
- `[x]` Implement `ScenarioDiscoveryAgentService` (`apps/api/src/common/context/scenario-discovery-agent.service.ts`)
- `[x]` Register `ScenarioDiscoveryAgentService` in NestJS `AppModule` (`apps/api/src/app.module.ts`)
- `[x]` Integrate the agent service and scenario persistence into `AnalysisProcessor` (`apps/api/src/analysis/analysis.processor.ts`)
- `[x]` Write unit tests for the agent service (`apps/api/src/common/context/scenario-discovery-agent.service.spec.ts`)
- `[x]` Verify build and run tests

## Part 4.4: Scenario Quality Evaluator
- `[x]` Create `scenario-quality.schema.ts` defining quality scores and scorecard validation
- `[x]` Export contracts and types in contracts `index.ts`
- `[x]` Extend Prisma `Scenario` model with new score fields (`priorityValidityScore`, `traceabilityQualityScore`, `coverageTargetScore`)
- `[x]` Extend Prisma `AnalysisRun` model with `scenarioQualityScorecard` JSON column
- `[x]` Regenerate Prisma Client and compile database package
- `[x]` Implement `ScenarioQualityEvaluatorService` (`apps/api/src/common/context/scenario-quality-evaluator.service.ts`)
- `[x]` Implement AI Critic Isolation (separating deterministic and AI completeness scores)
- `[x]` Implement Scenario Generation Readiness checks (score >= 70, no individual score < 50, failure rate < 30%)
- `[x]` Implement scorecard versioning (`evaluationVersion: "1.0.0"`)
- `[x]` Register `ScenarioQualityEvaluatorService` in NestJS `AppModule`
- `[x]` Integrate the evaluator into `AnalysisProcessor` to save scores and scorecard transactionally
- `[x]` Write unit tests for the quality service (`apps/api/src/common/context/scenario-quality-evaluator.service.spec.ts`)
- `[x]` Verify build and run tests

## Part 5.1: Test Case Discovery Contracts
- `[x]` Create and refine `packages/contracts/src/test-case.schema.ts`
- `[x]` Add stable `testCaseKey` support (e.g. TC-LOGIN-001)
- `[x]` Add `riskLevel` support with enum validation
- `[x]` Add `automationStatus` and `automationPath` support to Zod schema and database models
- `[x]` Support Contract Versioning (`contractVersion: "1.0.0"`)
- `[x]` Support Discovery Output Metadata (`generationMetadata` structure)
- `[x]` Add Traceability metadata (`testCaseOrigin` mapping)
- `[x]` Define `TestCase` and `TestCaseQuality` models in Prisma Schema
- `[x]` Export contracts, validators, and inferred TypeScript typings in `packages/contracts/src/index.ts`
- `[x]` Run `prisma generate` to update database client
- `[x]` Verify clean build compile across the monorepo workspace

## Part 5.2: Test Case Discovery Context Builder
- `[x]` Add `testCaseDiscoveryContext` and `testCaseQualityScorecard` columns to `AnalysisRun` in `schema.prisma`
- `[x]` Regenerate Prisma Client and compile database package
- `[x]` Implement `TestCaseDiscoveryContextBuilderService` inside NestJS application (`apps/api/src/common/context/`)
- `[x]` Implement path casing normalization, description truncation, and deduplication logic
- `[x]` Implement scenario selection capping and priority sorting (quality > confidence > risk)
- `[x]` Implement readiness evaluation rules (average quality >= 70, failing ratio < 30%, scenario count > 0)
- `[x]` Register the context builder service in NestJS `AppModule`
- `[x]` Integrate the builder service inside `AnalysisProcessor` workflow and cache the context in database
- `[x]` Write unit tests in `apps/api/src/common/context/test-case-discovery-context-builder.service.spec.ts`
- `[x]` Verify monorepo builds successfully (`npm run build`)

## Part 5.3: Test Case Discovery Agent
- `[x]` Create and implement `TestCaseDiscoveryAgentService` (`apps/api/src/common/context/test-case-discovery-agent.service.ts`)
- `[x]` Implement prompt builder querying Gemini via JSON mode
- `[x]` Implement Grounding Engine (evidence normalization, asset casing and suffix matching, ungrounded path discards)
- `[x]` Implement Traceability Resolver (feature, scenario, and workflow origin mapping, workflow slugification, orphan discards)
- `[x]` Implement Coverage Target validation (grouping targets, discarding if all arrays are empty)
- `[x]` Implement Confidence Normalization ($0.0 \to 1.0$) based on evidence, workflows, scenario quality, and coverage targets
- `[x]` Implement Business Key Sequencer (`TC-[FEATURE]-[SEQUENCE]`) with sorting and collision protection
- `[x]` Implement Guardrail Checks (2-10 count limits, functional/negative mixes, risk requirements)
- `[x]` Implement Test Case Generation Readiness scorecard
- `[x]` Register the agent service in NestJS `AppModule`
- `[x]` Integrate the agent service in `AnalysisProcessor` workflow
- `[x]` Implement transaction boundaries (`prisma.$transaction`) to persist test cases and scenario relationships
- `[x]` Verify monorepo compiles successfully (`npm run build`)
