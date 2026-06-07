import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') });
import { prisma } from '@testlens/db';

async function main() {
  try {
    console.log('Connecting to database...');
    const projects = await prisma.project.findMany();
    console.log(`Connection successful! Found ${projects.length} project(s):`);
    console.log(JSON.stringify(projects, null, 2));
  } catch (error: any) {
    console.error('Database connection failed:', error.message);
  }
}

main().catch(console.error);
