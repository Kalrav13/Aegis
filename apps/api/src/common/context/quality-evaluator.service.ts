import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  AiReadyContext,
  RepositoryUnderstanding,
  QualityScorecard,
  QualityScorecardSchema
} from '@testlens/contracts';

@Injectable()
export class QualityEvaluatorService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Evaluates the repository understanding output against the context.
   */
  public async evaluate(
    context: AiReadyContext,
    understanding: RepositoryUnderstanding
  ): Promise<QualityScorecard> {
    // 1. Run deterministic scoring metrics
    const deterministic = this.calculateDeterministicMetrics(context, understanding);

    // 2. Run LLM critic completeness checks
    const critic = await this.callLlmCritic(context, understanding);

    // 3. Compile and build the scorecard
    const scorecard = this.buildScorecard(deterministic, critic);

    // 4. Validate output matches the contract schema
    return QualityScorecardSchema.parse(scorecard);
  }

  /**
   * Computes evidence coverage and confidence reliability scores.
   */
  private calculateDeterministicMetrics(
    context: AiReadyContext,
    understanding: RepositoryUnderstanding
  ) {
    const validFiles = new Set<string>();

    if (context.routes_and_apis) {
      for (const route of context.routes_and_apis) {
        if (route.files) {
          for (const f of route.files) {
            validFiles.add(f.toLowerCase().replace(/\\/g, '/'));
          }
        }
      }
    }

    if (context.forms) {
      for (const form of context.forms) {
        if (form.path) {
          validFiles.add(form.path.toLowerCase().replace(/\\/g, '/'));
        }
      }
    }

    if (context.evidence_index) {
      for (const [key, files] of Object.entries(context.evidence_index)) {
        validFiles.add(key.toLowerCase().replace(/\\/g, '/'));
        if (Array.isArray(files)) {
          for (const f of files) {
            validFiles.add(f.toLowerCase().replace(/\\/g, '/'));
          }
        }
      }
    }

    const inferences = [
      { name: 'Application Purpose', item: understanding.applicationPurpose },
      ...(understanding.targetUsers || []).map(u => ({ name: `User Role: ${u.role}`, item: u })),
      ...(understanding.businessDomains || []).map(d => ({ name: `Business Domain: ${d.name}`, item: d })),
      ...(understanding.coreWorkflows || []).map(w => ({ name: `Workflow: ${w.name}`, item: w })),
      ...(understanding.highRiskWorkflows || []).map(r => ({ name: `High-Risk Workflow: ${r.name}`, item: r }))
    ];

    const totalInferences = inferences.length;
    if (totalInferences === 0) {
      return {
        evidenceCoverageScore: 100,
        confidenceReliabilityScore: 100,
        workflowCoverageScore: 100,
        warnings: [] as string[]
      };
    }

    const hasValidEvidence = (evidenceList: string[] | undefined): boolean => {
      if (!evidenceList || !Array.isArray(evidenceList) || evidenceList.length === 0) {
        return false;
      }
      for (const rawPath of evidenceList) {
        const pathNorm = rawPath.toLowerCase().replace(/\\/g, '/').trim();
        if (validFiles.has(pathNorm)) {
          return true;
        }
        for (const file of validFiles) {
          if (file.endsWith(pathNorm) || pathNorm.endsWith(file)) {
            return true;
          }
        }
      }
      return false;
    };

    let groundedCount = 0;
    let totalPenalty = 0;
    const warnings: string[] = [];

    for (const entry of inferences) {
      const evidence = entry.item?.evidence || [];
      const confidence = entry.item?.confidenceScore ?? 0.5;

      const isGrounded = hasValidEvidence(evidence);
      if (isGrounded) {
        groundedCount++;
      } else {
        warnings.push(`[Deterministic] Weak or ungrounded evidence cited for: "${entry.name}"`);
      }

      // Filter cited evidence list to find valid files only
      const validEvidenceCount = evidence.filter(e => {
        const pathNorm = e.toLowerCase().replace(/\\/g, '/').trim();
        if (validFiles.has(pathNorm)) return true;
        for (const file of validFiles) {
          if (file.endsWith(pathNorm) || pathNorm.endsWith(file)) return true;
        }
        return false;
      }).length;

      // Confidence anomaly checks
      if (confidence > 0.85 && validEvidenceCount === 1) {
        totalPenalty += 15;
        warnings.push(`[Deterministic] High confidence (${confidence}) with minimal evidence (1 file) for "${entry.name}"`);
      } else if (confidence > 0.8 && validEvidenceCount === 0) {
        totalPenalty += 30;
        warnings.push(`[Deterministic] High confidence (${confidence}) with zero evidence for "${entry.name}"`);
      }
    }

    const evidenceCoverageScore = Math.round((groundedCount / totalInferences) * 100);
    const confidenceReliabilityScore = Math.max(0, 100 - Math.round(totalPenalty / totalInferences));

    // Workflow coverage check
    const coveredRoutes = new Set<string>();
    if (understanding.coreWorkflows) {
      for (const wf of understanding.coreWorkflows) {
        if (wf.associatedRoutes) {
          for (const r of wf.associatedRoutes) {
            coveredRoutes.add(r.toLowerCase().trim());
          }
        }
        if (wf.associatedApis) {
          for (const api of wf.associatedApis) {
            coveredRoutes.add(api.toLowerCase().trim());
          }
        }
      }
    }

    let matchedRoutes = 0;
    const totalRoutes = context.routes_and_apis?.length || 0;
    if (totalRoutes > 0) {
      for (const rObj of context.routes_and_apis) {
        const rNorm = rObj.route.toLowerCase().trim();
        let matched = false;
        if (coveredRoutes.has(rNorm)) {
          matched = true;
        } else {
          for (const cov of coveredRoutes) {
            if (cov.includes(rNorm) || rNorm.includes(cov)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          matchedRoutes++;
        }
      }
    }

    let matchedForms = 0;
    const totalForms = context.forms?.length || 0;
    if (totalForms > 0) {
      for (const form of context.forms) {
        const formPath = (form.path || '').toLowerCase().trim();
        let matched = false;
        if (coveredRoutes.has(formPath)) {
          matched = true;
        } else {
          for (const cov of coveredRoutes) {
            if (cov.includes(formPath) || formPath.includes(cov)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          matchedForms++;
        }
      }
    }

    const routeCoverage = totalRoutes > 0 ? (matchedRoutes / totalRoutes) * 100 : 100;
    const formCoverage = totalForms > 0 ? (matchedForms / totalForms) * 100 : 100;
    const workflowCoverageScore = Math.round((routeCoverage * 0.7) + (formCoverage * 0.3));

    return {
      evidenceCoverageScore,
      confidenceReliabilityScore,
      workflowCoverageScore,
      warnings
    };
  }

  /**
   * Invokes Gemini model critic using structured JSON schemas to evaluate completeness.
   */
  private async callLlmCritic(
    context: AiReadyContext,
    understanding: RepositoryUnderstanding
  ): Promise<{ completenessScore: number; warnings: string[] }> {
    const prompt = `
You are a hostile, highly meticulous Principal QA Reviewer criticising a generated Repository Understanding.
Analyze the target codebase's physical assets (routes, forms, tech stack) from the Ingestion Context, and contrast them against the Inferred Understanding.

Your goal is to detect gaps:
1. Identify missing workflows. (e.g. if routes_and_apis includes "/api/checkout" or "/api/pay" but no payment/checkout workflows are listed in understanding.coreWorkflows).
2. Identify missing user roles. (e.g. if "/admin" is in routes_and_apis but no "Admin" or "Superuser" is defined under targetUsers).
3. Detect inconsistencies.

=== INGESTION CONTEXT ===
- Tech Stack: ${JSON.stringify(context.tech_stack)}
- Routes/Endpoints: ${JSON.stringify(context.routes_and_apis?.map(r => ({ route: r.route, type: r.type })))}
- Consolidated Forms: ${JSON.stringify(context.forms?.map(f => ({ path: f.path, form_name: f.form_name })))}

=== INFERRED UNDERSTANDING ===
- Purpose: ${understanding.applicationPurpose?.summary}
- Target Users: ${JSON.stringify(understanding.targetUsers?.map(u => u.role))}
- Business Domains: ${JSON.stringify(understanding.businessDomains?.map(d => d.name))}
- Core Workflows: ${JSON.stringify(understanding.coreWorkflows?.map(w => ({ name: w.name, routes: w.associatedRoutes, apis: w.associatedApis })))}
- High Risk Workflows: ${JSON.stringify(understanding.highRiskWorkflows?.map(r => r.name))}

=== OUTPUT FORMAT ===
You MUST return a JSON object with EXACTLY the following structure:
{
  "completenessScore": <number between 0 and 100 evaluating how well the understanding maps the codebase endpoints and forms>,
  "warnings": [
    "<string warning describing a missing workflow, missing role, or semantic gap>"
  ]
}

Ensure you only list up to 5 of the most critical warnings. Keep warning messages direct and actionable.
`;

    try {
      const rawResult = await this.aiService.generateJson(prompt);
      const parsed = JSON.parse(rawResult);
      
      const completenessScore = typeof parsed.completenessScore === 'number'
        ? Math.min(100, Math.max(0, parsed.completenessScore))
        : 75;

      const warnings = Array.isArray(parsed.warnings)
        ? parsed.warnings.map((w: any) => String(w).trim())
        : [];

      return { completenessScore, warnings };
    } catch (error: any) {
      console.warn('LLM Critic evaluation failed, falling back to basic metrics.', error.message);
      return {
        completenessScore: 70, // generic fallback
        warnings: ['[LLM Critic Engine failed to process warnings]']
      };
    }
  }

  /**
   * Compiles deterministic and critic outputs into a composite scorecard.
   */
  private buildScorecard(
    deterministic: ReturnType<typeof QualityEvaluatorService.prototype.calculateDeterministicMetrics>,
    critic: { completenessScore: number; warnings: string[] }
  ): QualityScorecard {
    // Score weights:
    // 30% completeness
    // 30% evidence coverage
    // 20% confidence reliability
    // 20% workflow coverage
    const qualityScore = Math.round(
      (critic.completenessScore * 0.3) +
      (deterministic.evidenceCoverageScore * 0.3) +
      (deterministic.confidenceReliabilityScore * 0.2) +
      (deterministic.workflowCoverageScore * 0.2)
    );

    const mergedWarnings = [
      ...deterministic.warnings,
      ...critic.warnings
    ];

    return {
      qualityScore,
      completenessScore: critic.completenessScore,
      evidenceCoverageScore: deterministic.evidenceCoverageScore,
      confidenceReliabilityScore: deterministic.confidenceReliabilityScore,
      workflowCoverageScore: deterministic.workflowCoverageScore,
      warnings: mergedWarnings
    };
  }
}
