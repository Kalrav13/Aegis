import { Injectable } from '@nestjs/common';
import {
  IntelligenceManifest,
  InteractionRegistry,
  AiReadyContext,
  validateContext
} from '@testlens/contracts';
import { consolidateRoutesAndApis } from './route-consolidator';
import { consolidateForms } from './form-consolidator';
import {
  buildTechStackSummary,
  buildComponentsSummary,
  buildEvidenceIndex
} from './context-helpers';

@Injectable()
export class ContextBuilderService {
  /**
   * Transforms raw manifest and registry intelligence into token-optimized AI-ready context.
   */
  public buildContext(
    manifest: IntelligenceManifest,
    registry: InteractionRegistry
  ): AiReadyContext {
    // 1. Consolidate routes and APIs
    const routesAndApis = consolidateRoutesAndApis(manifest, registry);

    // 2. Consolidate forms
    const forms = consolidateForms(registry);

    // 3. Tech Stack Summary
    const techStack = buildTechStackSummary(manifest);

    // 4. Components Summary
    const componentsSummary = buildComponentsSummary(manifest);

    // 5. Evidence Index
    const evidenceIndex = buildEvidenceIndex(manifest, registry, routesAndApis, forms);

    // 6. Build final payload
    const rawContext: AiReadyContext = {
      metadata: {
        commit_sha: manifest.version_metadata.commit_sha,
        timestamp: new Date().toISOString(),
        total_files: manifest.statistics.total_filtered_files,
        total_size_bytes: manifest.statistics.total_filtered_size_bytes,
        file_extensions: manifest.statistics.file_type_distribution
      },
      tech_stack: techStack,
      routes_and_apis: routesAndApis,
      forms,
      components_summary: componentsSummary,
      evidence_index: evidenceIndex
    };

    // 7. Validate contract bounds
    return validateContext(rawContext);
  }
}
