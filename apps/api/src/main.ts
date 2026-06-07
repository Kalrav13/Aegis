import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './common/config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend clients
  app.enableCors({
    origin: [
      'https://testlens-six.vercel.app',
      /\.vercel\.app$/, // Allow Vercel preview deployments
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Set global API prefix, excluding root and health check endpoints
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', '']
  });

  const configService = app.get(AppConfigService);
  const port = configService.port;

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 TestLens API Server successfully running on http://localhost:${port}/api/v1`);
}
bootstrap();
