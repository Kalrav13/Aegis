import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { FilterManifest } from '../filter/filter.service';
import { PACKAGE_FILES, CONFIG_FILES } from './manifest.config';

export interface IntelligenceManifest {
  version_metadata: {
    commit_sha: string;
    timestamp: string;
  };
  directories: {
    paths: string[];
    total_directories: number;
  };
  package_files: Array<{
    path: string;
    type: "npm" | "composer" | "cargo" | "bundler" | "go" | "python" | "maven" | "gradle";
  }>;
  config_files: Array<{
    path: string;
    type: string;
  }>;
  route_candidates: Array<{
    path: string;
    framework_context: "pages" | "app" | "routes" | "unknown";
  }>;
  api_candidates: Array<{
    path: string;
    method_hint: string | null;
  }>;
  component_candidates: Array<{
    path: string;
    framework: "react" | "vue" | "unknown";
  }>;
  statistics: {
    total_filtered_files: number;
    total_filtered_size_bytes: number;
    file_type_distribution: Record<string, number>;
  };
}

@Injectable()
export class ManifestService {
  /**
   * Generates a deterministic repository manifest based on files and naming heuristics.
   */
  public async generateManifest(
    filteredManifest: FilterManifest,
    commitSha: string
  ): Promise<IntelligenceManifest> {
    const uniqueDirs = new Set<string>();
    const packageFiles: IntelligenceManifest['package_files'] = [];
    const configFiles: IntelligenceManifest['config_files'] = [];
    const routeCandidates: IntelligenceManifest['route_candidates'] = [];
    const apiCandidates: IntelligenceManifest['api_candidates'] = [];
    const componentCandidates: IntelligenceManifest['component_candidates'] = [];
    const fileTypeDistribution: Record<string, number> = {};

    for (const file of filteredManifest.filtered_files) {
      const normalizedPath = file.path.replace(/\\/g, '/'); // Enforce forward slash routes
      const filename = path.basename(normalizedPath);
      const ext = path.extname(filename).toLowerCase();
      
      // 1. Build directory statistics
      const dir = path.dirname(normalizedPath);
      if (dir && dir !== '.') {
        uniqueDirs.add(dir);
      }

      // 2. Map extension distributions
      fileTypeDistribution[ext] = (fileTypeDistribution[ext] || 0) + 1;

      // 3. Find Package Files
      const lowerFilename = filename.toLowerCase();
      if (PACKAGE_FILES[lowerFilename]) {
        packageFiles.push({
          path: normalizedPath,
          type: PACKAGE_FILES[lowerFilename]
        });
      }

      // 4. Find Configuration Files
      if (CONFIG_FILES[lowerFilename]) {
        configFiles.push({
          path: normalizedPath,
          type: CONFIG_FILES[lowerFilename]
        });
      }

      // Create a normalized check path starting with a leading slash, lowercased for case-insensitivity
      const checkPath = ('/' + normalizedPath).toLowerCase();

      // 5. Heuristic: Route Candidates
      if (
        checkPath.includes('/pages/') ||
        checkPath.includes('/app/') ||
        checkPath.includes('/routes/') ||
        lowerFilename.includes('route.') ||
        lowerFilename.includes('controller.')
      ) {
        let context: "pages" | "app" | "routes" | "unknown" = 'unknown';
        if (checkPath.includes('/pages/')) context = 'pages';
        else if (checkPath.includes('/app/')) context = 'app';
        else if (checkPath.includes('/routes/')) context = 'routes';

        routeCandidates.push({
          path: normalizedPath,
          framework_context: context
        });
      }

      // 6. Heuristic: API Candidates
      if (
        checkPath.includes('/api/') ||
        checkPath.includes('/controllers/') ||
        checkPath.includes('/endpoints/') ||
        checkPath.includes('/server/')
      ) {
        let methodHint: string | null = null;
        if (lowerFilename.includes('get')) methodHint = 'GET';
        else if (lowerFilename.includes('post')) methodHint = 'POST';
        else if (lowerFilename.includes('put')) methodHint = 'PUT';
        else if (lowerFilename.includes('delete')) methodHint = 'DELETE';

        apiCandidates.push({
          path: normalizedPath,
          method_hint: methodHint
        });
      }

      // 7. Heuristic: Component Candidates
      if (
        ext === '.tsx' ||
        ext === '.jsx' ||
        checkPath.includes('/components/') ||
        checkPath.includes('/views/') ||
        checkPath.includes('/ui/')
      ) {
        let framework: "react" | "vue" | "unknown" = 'unknown';
        if (ext === '.tsx' || ext === '.jsx' || checkPath.includes('/components/')) {
          framework = 'react';
        }
        componentCandidates.push({
          path: normalizedPath,
          framework
        });
      }
    }

    return {
      version_metadata: {
        commit_sha: commitSha,
        timestamp: new Date().toISOString()
      },
      directories: {
        paths: Array.from(uniqueDirs).sort(),
        total_directories: uniqueDirs.size
      },
      package_files: packageFiles,
      config_files: configFiles,
      route_candidates: routeCandidates,
      api_candidates: apiCandidates,
      component_candidates: componentCandidates,
      statistics: {
        total_filtered_files: filteredManifest.repository_statistics.total_filtered_files,
        total_filtered_size_bytes: filteredManifest.repository_statistics.total_filtered_size_bytes,
        file_type_distribution: fileTypeDistribution
      }
    };
  }
}
