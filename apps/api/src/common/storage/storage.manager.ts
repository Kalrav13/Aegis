import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageManager {
  private readonly baseRepoPath: string;

  constructor() {
    // Stores cloned repos under root data/repos folder
    this.baseRepoPath = path.resolve(process.cwd(), 'data', 'repos');
  }

  /**
   * Retrieves the physical folder path for a cloned repository analysis.
   */
  public getRepoPath(projectId: string, analysisId: string): string {
    return path.join(this.baseRepoPath, projectId, analysisId);
  }

  /**
   * Calculates the cumulative folder size recursively in bytes.
   */
  public async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Return 0 if path is missing or inaccessible during processing
      totalSize = 0;
    }

    return totalSize;
  }

  /**
   * Deletes the local cloned repository folder recursively.
   */
  public async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to clean directory path: ${dirPath}`, error);
    }
  }
}
