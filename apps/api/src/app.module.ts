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
    RegistryService
  ],
  exports: [
    AppConfigService,
    ProjectsService,
    AnalysisService,
    FilterService,
    ManifestService,
    RegistryService
  ]
})
export class AppModule {}
