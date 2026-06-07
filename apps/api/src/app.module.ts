import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './common/config/config.validation';
import { AppConfigService } from './common/config/config.service';
import { ProjectsService } from './projects/projects.service';
import { ProjectsController } from './projects/projects.controller';
import { AnalysisService } from './analysis/analysis.service';
import { AnalysisProcessor } from './analysis/analysis.processor';
import { AnalysisController } from './analysis/analysis.controller';
import { GitService } from './common/git/git.service';
import { StorageManager } from './common/storage/storage.manager';
import { FilterService } from './common/filter/filter.service';
import { ManifestService } from './common/manifest/manifest.service';
import { UiScannerService } from './common/registry/ui-scanner.service';
import { ApiScannerService } from './common/registry/api-scanner.service';
import { RegistryService } from './common/registry/registry.service';
import { ContextBuilderService } from './common/context/context-builder.service';
import { DiscoveryContextBuilderService } from './common/context/discovery-context-builder.service';
import { FeatureDiscoveryAgentService } from './common/context/feature-discovery-agent.service';
import { QualityEvaluatorService } from './common/context/quality-evaluator.service';
import { FeatureQualityEvaluatorService } from './common/context/feature-quality-evaluator.service';
import { ScenarioDiscoveryContextBuilderService } from './common/context/scenario-discovery-context-builder.service';
import { ScenarioDiscoveryAgentService } from './common/context/scenario-discovery-agent.service';
import { ScenarioQualityEvaluatorService } from './common/context/scenario-quality-evaluator.service';
import { TestCaseDiscoveryContextBuilderService } from './common/context/test-case-discovery-context-builder.service';
import { TestCaseDiscoveryAgentService } from './common/context/test-case-discovery-agent.service';
import { TestCaseQualityEvaluatorService } from './common/context/test-case-quality-evaluator.service';
import { AutomationDiscoveryContextBuilderService } from './common/context/automation-discovery-context-builder.service';
import { AutomationGenerationAgentService } from './common/context/automation-generation-agent.service';
import { AutomationQualityEvaluatorService } from './common/context/automation-quality-evaluator.service';
import { AiService } from './common/ai/ai.service';
import { UnderstandingAgentService } from './common/understanding/understanding-agent.service';
import { CoverageIntelligenceService } from './common/context/coverage-intelligence.service';
import { CoverageReportingService } from './common/context/coverage-reporting.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig
    })
  ],
  controllers: [
    ProjectsController,
    AnalysisController
  ],
  providers: [
    AppConfigService,
    ProjectsService,
    AnalysisService,
    AnalysisProcessor,
    GitService,
    StorageManager,
    FilterService,
    ManifestService,
    UiScannerService,
    ApiScannerService,
    RegistryService,
    ContextBuilderService,
    DiscoveryContextBuilderService,
    FeatureDiscoveryAgentService,
    QualityEvaluatorService,
    FeatureQualityEvaluatorService,
    ScenarioDiscoveryContextBuilderService,
    ScenarioDiscoveryAgentService,
    ScenarioQualityEvaluatorService,
    TestCaseDiscoveryContextBuilderService,
    TestCaseDiscoveryAgentService,
    TestCaseQualityEvaluatorService,
    AutomationDiscoveryContextBuilderService,
    AutomationGenerationAgentService,
    AutomationQualityEvaluatorService,
    AiService,
    UnderstandingAgentService,
    CoverageIntelligenceService,
    CoverageReportingService
  ],

  exports: [
    AppConfigService,
    ProjectsService,
    AnalysisService,
    FilterService,
    ManifestService,
    RegistryService,
    ContextBuilderService,
    DiscoveryContextBuilderService,
    FeatureDiscoveryAgentService,
    QualityEvaluatorService,
    FeatureQualityEvaluatorService,
    ScenarioDiscoveryContextBuilderService,
    ScenarioDiscoveryAgentService,
    ScenarioQualityEvaluatorService,
    TestCaseDiscoveryContextBuilderService,
    TestCaseDiscoveryAgentService,
    TestCaseQualityEvaluatorService,
    AutomationDiscoveryContextBuilderService,
    AutomationGenerationAgentService,
    AutomationQualityEvaluatorService,
    UnderstandingAgentService,
    CoverageIntelligenceService,
    CoverageReportingService
  ]

})
export class AppModule {}
