import { IntelligenceManifest, InteractionRegistry, AiReadyContext } from '@testlens/contracts';
import * as path from 'path';

export function consolidateRoutesAndApis(
  manifest: IntelligenceManifest,
  registry: InteractionRegistry
): AiReadyContext['routes_and_apis'] {
  const routesMap = new Map<string, AiReadyContext['routes_and_apis'][number]>();

  // 1. Process Route Candidates (Frontend Pages)
  for (const page of manifest.route_candidates) {
    const rawPath = page.path;
    const cleanRoute = derivePageRoute(rawPath, page.framework_context);
    const params = extractParamsFromRouteString(cleanRoute);

    const existing = routesMap.get(cleanRoute);
    if (existing) {
      if (!existing.files.includes(rawPath)) {
        existing.files.push(rawPath);
      }
      if (existing.type !== 'page') {
        existing.type = 'page'; // Upgrade page type over unknown
      }
    } else {
      routesMap.set(cleanRoute, {
        route: cleanRoute,
        type: 'page',
        methods: ['GET'], // Pages correspond to GET requests
        parameters: params,
        files: [rawPath]
      });
    }
  }

  // 2. Process API Endpoints (Backend API routes)
  for (const api of registry.api_endpoints) {
    const rawRoute = api.route;
    const cleanRoute = rawRoute.startsWith('/') ? rawRoute : '/' + rawRoute;
    const params = api.parameters || [];

    const existing = routesMap.get(cleanRoute);
    if (existing) {
      if (!existing.methods.includes(api.method)) {
        existing.methods.push(api.method);
      }
      if (!existing.files.includes(api.path)) {
        existing.files.push(api.path);
      }
      // Combine parameters
      const combinedParams = Array.from(new Set([...existing.parameters, ...params]));
      existing.parameters = combinedParams;
      
      // If a path has registered methods and is under /api/, force "api" type
      if (cleanRoute.includes('/api/')) {
        existing.type = 'api';
      }
    } else {
      routesMap.set(cleanRoute, {
        route: cleanRoute,
        type: cleanRoute.includes('/api/') ? 'api' : 'api',
        methods: [api.method],
        parameters: params,
        files: [api.path]
      });
    }
  }

  return Array.from(routesMap.values());
}

function derivePageRoute(filePath: string, context: string): string {
  let relative = filePath.replace(/\\/g, '/');
  
  // Strip common root segments
  if (context === 'pages') {
    relative = relative.replace(/^.*\/pages\//, '');
    relative = relative.replace(/^pages\//, '');
  } else if (context === 'app') {
    relative = relative.replace(/^.*\/app\//, '');
    relative = relative.replace(/^app\//, '');
  } else if (context === 'routes') {
    relative = relative.replace(/^.*\/routes\//, '');
    relative = relative.replace(/^routes\//, '');
  }

  // Strip file extensions
  const ext = path.extname(relative);
  if (ext) {
    relative = relative.substring(0, relative.length - ext.length);
  }

  // Strip trailing page/index segments
  if (relative.endsWith('/page')) {
    relative = relative.substring(0, relative.length - 5);
  } else if (relative.endsWith('/route')) {
    relative = relative.substring(0, relative.length - 6);
  } else if (relative === 'page' || relative === 'route' || relative === 'index') {
    relative = '';
  }

  if (relative.endsWith('/index')) {
    relative = relative.substring(0, relative.length - 6);
  }

  // Prepend slash and clean up
  let route = relative.startsWith('/') ? relative : '/' + relative;
  if (route.endsWith('/') && route.length > 1) {
    route = route.substring(0, route.length - 1);
  }

  // Replace Next.js style [id] with Express style :id for consistency
  route = route.replace(/\[([a-zA-Z0-9_]+)\]/g, ':$1');

  return route;
}

function extractParamsFromRouteString(route: string): string[] {
  const params = new Set<string>();
  const regex = /:([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(route)) !== null) {
    params.add(match[1]);
  }
  return Array.from(params);
}
