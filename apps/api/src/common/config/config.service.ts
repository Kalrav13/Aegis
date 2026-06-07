import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from './config.validation';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService<Environment, true>) {}

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get geminiApiKey(): string {
    return this.configService.get('GEMINI_API_KEY', { infer: true });
  }

  get jwtSecret(): string {
    return this.configService.get('JWT_SECRET', { infer: true });
  }

  get featureDiscoveryMinQualityScore(): number {
    return this.configService.get('FEATURE_DISCOVERY_MIN_QUALITY_SCORE', { infer: true });
  }
}
