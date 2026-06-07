import * as path from 'path';
import * as dotenv from 'dotenv';
// Load environment variables from workspace root .env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AnalysisProcessor } from './analysis/analysis.processor';
import { prisma } from '@testlens/db';
import { randomUUID } from 'crypto';

async function main() {
  const repoUrl = 'https://github.com/MOHITPIPALIYA2911/repoLens';
  const branch = 'main';

  console.log('Bootstrapping TestLens NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const processor = app.get(AnalysisProcessor);

  try {
    console.log(`Checking if project exists for repo: ${repoUrl}`);
    let project = await prisma.project.findFirst({
      where: { repoUrl }
    });

    if (!project) {
      console.log('Creating new project entry in database...');
      project = await prisma.project.create({
        data: {
          id: randomUUID(),
          name: 'repoLens',
          repoUrl,
          branch
        }
      });
    }

    console.log(`Creating new AnalysisRun entry for project ID: ${project.id}...`);
    const run = await prisma.analysisRun.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        status: 'CLONING',
        commitSha: 'pending'
      }
    });

    console.log(`\n>>> Starting Full Scenario Discovery Pipeline (Run ID: ${run.id}) <<<`);
    console.log(`Repository: ${repoUrl} (Branch: ${branch})`);
    
    // Execute the full pipeline synchronously
    await processor.executeClone(run.id, repoUrl, branch);
    
    console.log('\n>>> Pipeline Execution Finished! <<<');
    
    // Query and check final run status
    const finalRun = await prisma.analysisRun.findUnique({
      where: { id: run.id }
    });
    console.log(`Final Run Status: ${finalRun?.status}`);
    if (finalRun?.status === 'FAILED') {
      console.error(`Error Message: ${finalRun.errorMessage}`);
    } else {
      console.log('Successfully discovered and evaluated features and scenarios!');
    }
  } catch (error: any) {
    console.error('Execution failed:', error.message);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
