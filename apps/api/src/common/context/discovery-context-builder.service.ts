import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import {
  AiReadyContext,
  RepositoryUnderstanding,
  QualityScorecard,
  IntelligenceManifest,
  DiscoveryContext,
  DiscoveryContextSchema
} from '@testlens/contracts';

@Injectable()
export class DiscoveryContextBuilderService {
  constructor(private readonly configService: AppConfigService) {}

  /**
   * Deterministically aggregates ingestion context and repository understanding outputs
   * into a token-optimized DiscoveryContext payload.
   */
  public buildDiscoveryContext(
    understanding: RepositoryUnderstanding,
    context: AiReadyContext,
    scorecard: QualityScorecard,
    manifest?: IntelligenceManifest
  ): DiscoveryContext {
    // 1. Quality Gate & Readiness Evaluation
    const threshold = this.configService.featureDiscoveryMinQualityScore;
    const isQualityPassing = scorecard.qualityScore >= threshold;

    const blockingReasons: string[] = [];
    if (!isQualityPassing) {
      blockingReasons.push(
        `Repository understanding quality score of ${scorecard.qualityScore} is below required threshold of ${threshold}.`
      );
    }
    // Forward critical scorecard warnings into blocking reasons if quality is low
    if (!isQualityPassing && scorecard.warnings && scorecard.warnings.length > 0) {
      blockingReasons.push(...scorecard.warnings);
    }

    // 2. Application Summary Layer
    const applicationSummary = {
      purpose: understanding.applicationPurpose?.summary || '',
      targetUsers: (understanding.targetUsers || []).map(u => u.role),
      businessDomains: (understanding.businessDomains || []).map(d => d.name)
    };

    // 3. Workflow Aggregation Layer
    const aggregatedWorkflows = (understanding.coreWorkflows || []).map(wf => ({
      name: wf.name,
      description: wf.description || '',
      steps: wf.steps || [],
      routes: wf.associatedRoutes || [],
      apis: wf.associatedApis || [],
      evidence: wf.evidence || []
    }));

    // 4. Risk Profile Layer
    const riskProfile = (understanding.highRiskWorkflows || []).map(hr => ({
      name: hr.name,
      riskFactor: hr.riskFactor || '',
      mitigationFocus: hr.mitigationFocus || ''
    }));

    // 5. Discovery Candidates Organizer
    const candidateRoutes = (context.routes_and_apis || [])
      .filter(r => r.type === 'page')
      .map(r => r.route);

    const candidateApis = (context.routes_and_apis || [])
      .filter(r => r.type === 'api')
      .map(r => r.route);

    const candidateForms = (context.forms || [])
      .map(f => f.path || '')
      .filter(p => p !== '');

    const candidateComponents = manifest?.component_candidates?.map(c => c.path) || [];

    const discoveryCandidates = {
      routes: candidateRoutes,
      apis: candidateApis,
      forms: candidateForms,
      components: candidateComponents
    };

    // 6. Evidence Summary Layer
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

    const isValidPath = (evidencePath: string) => {
      const pathNorm = evidencePath.toLowerCase().replace(/\\/g, '/').trim();
      if (validFiles.has(pathNorm)) return true;
      for (const file of validFiles) {
        if (file.endsWith(pathNorm) || pathNorm.endsWith(file)) {
          return true;
        }
      }
      return false;
    };

    const citedEvidence = new Set<string>();
    if (understanding.applicationPurpose?.evidence) {
      understanding.applicationPurpose.evidence.forEach(e => citedEvidence.add(e));
    }
    (understanding.targetUsers || []).forEach(u => {
      if (u.evidence) u.evidence.forEach(e => citedEvidence.add(e));
    });
    (understanding.businessDomains || []).forEach(d => {
      if (d.evidence) d.evidence.forEach(e => citedEvidence.add(e));
    });
    (understanding.coreWorkflows || []).forEach(w => {
      if (w.evidence) w.evidence.forEach(e => citedEvidence.add(e));
    });
    (understanding.highRiskWorkflows || []).forEach(r => {
      if (r.evidence) r.evidence.forEach(e => citedEvidence.add(e));
    });

    let mappedCount = 0;
    for (const e of citedEvidence) {
      if (isValidPath(e)) {
        mappedCount++;
      }
    }

    const totalEvidenceFiles = context.metadata?.total_files || validFiles.size || 0;
    const mappedEvidenceFiles = mappedCount;
    const unmappedEvidenceFiles = Math.max(0, totalEvidenceFiles - mappedEvidenceFiles);

    const evidenceSummary = {
      totalEvidenceFiles,
      mappedEvidenceFiles,
      unmappedEvidenceFiles
    };

    // 7. Assemble Complete DiscoveryContext Payload
    const rawContext: DiscoveryContext = {
      contextVersion: '1.0.0',
      builderMetadata: {
        generatedAt: new Date().toISOString(),
        qualityThresholdUsed: threshold
      },
      applicationSummary,
      aggregatedWorkflows,
      riskProfile,
      discoveryReadiness: {
        ready: isQualityPassing,
        blockingReasons
      },
      evidenceSummary,
      discoveryCandidates,
      qualityGate: {
        qualityScore: scorecard.qualityScore,
        isQualityPassing,
        warnings: scorecard.warnings || []
      }
    };

    // 8. Validate against Zod output contract
    return DiscoveryContextSchema.parse(rawContext);
  }
}
