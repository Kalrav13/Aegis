import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import { APIEndpoint } from './registry.types';
import {
  NESTJS_ROUTE_REGEX,
  EXPRESS_ROUTE_REGEX,
  AXIOS_ROUTE_REGEX,
  FETCH_ROUTE_REGEX,
  EXPRESS_PARAM_REGEX,
  NEXTJS_PARAM_REGEX
} from './registry.config';

@Injectable()
export class ApiScannerService {
  private readonly MAX_SCAN_SIZE_BYTES = 1048576; // 1MB scan ceiling

  /**
   * Scans a file and extracts API endpoints.
   */
  public async scanFile(absolutePath: string, relativePath: string): Promise<APIEndpoint[]> {
    try {
      const stats = await fs.stat(absolutePath);
      if (stats.size > this.MAX_SCAN_SIZE_BYTES) {
        console.warn(`Skipping API scan of large file: ${relativePath} (${stats.size} bytes)`);
        return [];
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      const endpoints: APIEndpoint[] = [];

      // 1. NestJS Decorator matching
      this.scanWithRegex(content, relativePath, NESTJS_ROUTE_REGEX, endpoints);

      // 2. Express Routing function matching
      this.scanWithRegex(content, relativePath, EXPRESS_ROUTE_REGEX, endpoints);

      // 3. Axios Client request matching
      this.scanWithRegex(content, relativePath, AXIOS_ROUTE_REGEX, endpoints);

      // 4. Fetch Client request matching
      this.scanWithRegex(content, relativePath, FETCH_ROUTE_REGEX, endpoints);

      return endpoints;
    } catch (error: any) {
      console.error(`Failed to scan API endpoints in ${relativePath}:`, error.message);
      return [];
    }
  }

  private scanWithRegex(content: string, relativePath: string, regex: RegExp, list: APIEndpoint[]): void {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const rawMethod = match[1].toUpperCase();
      const method = this.normalizeMethod(rawMethod);
      if (!method) continue;

      const route = match[2];
      const parameters = this.extractRouteParameters(route);

      // Avoid duplicates inside same file
      const isDuplicate = list.some(
        (ep) => ep.route === route && ep.method === method && ep.path === relativePath
      );

      if (!isDuplicate) {
        list.push({
          path: relativePath.replace(/\\/g, '/'),
          method,
          route,
          parameters
        });
      }
    }
  }

  private normalizeMethod(rawMethod: string): APIEndpoint['method'] | null {
    if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(rawMethod)) {
      return rawMethod as APIEndpoint['method'];
    }
    return null;
  }

  private extractRouteParameters(route: string): string[] {
    const params = new Set<string>();

    // Scan Express parameters (:paramName)
    EXPRESS_PARAM_REGEX.lastIndex = 0;
    let match;
    while ((match = EXPRESS_PARAM_REGEX.exec(route)) !== null) {
      params.add(match[1]);
    }

    // Scan Next.js parameters ([paramName])
    NEXTJS_PARAM_REGEX.lastIndex = 0;
    while ((match = NEXTJS_PARAM_REGEX.exec(route)) !== null) {
      params.add(match[1]);
    }

    return Array.from(params);
  }
}
