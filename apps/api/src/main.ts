import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './common/config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend clients
  app.enableCors();
  
  // Set global API prefix
  app.setGlobalPrefix('api/v1');

  const configService = app.get(AppConfigService);
  const port = configService.port;

  await app.listen(port);
  console.log(`🚀 TestLens API Server successfully running on http://localhost:${port}/api/v1`);
}
bootstrap();
