import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ALLOWED_EXTENSIONS, IGNORED_DIRECTORIES } from './filter.config';

export interface FileItem {
  path: string;
  size_bytes: number;
}

export interface IgnoredItem {
  path: string;
  reason: 'directory' | 'extension' | 'inaccessible';
}

export interface FilterManifest {
  repository_statistics: {
    total_original_files: number;
    total_original_size_bytes: number;
    total_filtered_files: number;
    total_filtered_size_bytes: number;
  };
  filtered_files: FileItem[];
  ignored_files: IgnoredItem[];
}

@Injectable()
export class FilterService {
  /**
   * Safe iterative Breadth-First Search (BFS) directory traverser.
   * Filters files according to whitelisted extensions and prunes blacklisted subtrees.
   */
  public async filterRepository(repoPath: string): Promise<FilterManifest> {
    const filteredFiles: FileItem[] = [];
    const ignoredFiles: IgnoredItem[] = [];
    
    let totalOriginalFiles = 0;
    let totalOriginalSizeBytes = 0;
    let totalFilteredSizeBytes = 0;

    // Queue holding directories to traverse
    const dirQueue: string[] = [repoPath];

    while (dirQueue.length > 0) {
      const currentDir = dirQueue.shift()!;
      
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(repoPath, fullPath);

          if (entry.isDirectory()) {
            // Prune blacklisted subtrees immediately
            if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) {
              ignoredFiles.push({
                path: relativePath,
                reason: 'directory'
              });
              continue;
            }
            // Add valid directories to execution queue
            dirQueue.push(fullPath);
          } else if (entry.isFile()) {
            totalOriginalFiles++;
            
            let stats;
            try {
              stats = await fs.stat(fullPath);
              totalOriginalSizeBytes += stats.size;
            } catch (err) {
              ignoredFiles.push({
                path: relativePath,
                reason: 'inaccessible'
              });
              continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            
            if (ALLOWED_EXTENSIONS.has(ext)) {
              filteredFiles.push({
                path: relativePath,
                size_bytes: stats.size
              });
              totalFilteredSizeBytes += stats.size;
            } else {
              ignoredFiles.push({
                path: relativePath,
                reason: 'extension'
              });
            }
          }
        }
      } catch (err) {
        // If directory read fails, record it as inaccessible and proceed
        const relativeDirPath = path.relative(repoPath, currentDir);
        ignoredFiles.push({
          path: relativeDirPath,
          reason: 'inaccessible'
        });
      }
    }

    return {
      repository_statistics: {
        total_original_files: totalOriginalFiles,
        total_original_size_bytes: totalOriginalSizeBytes,
        total_filtered_files: filteredFiles.length,
        total_filtered_size_bytes: totalFilteredSizeBytes
      },
      filtered_files: filteredFiles,
      ignored_files: ignoredFiles
    };
  }
}
