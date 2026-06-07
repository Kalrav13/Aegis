import { IntelligenceManifest, InteractionRegistry, AiReadyContext } from '@testlens/contracts';
import * as path from 'path';

export function buildTechStackSummary(manifest: IntelligenceManifest): AiReadyContext['tech_stack'] {
  const packageManagers = new Set<string>();
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const configProfiles = new Set<string>();

  // 1. Package managers
  for (const pkg of manifest.package_files) {
    packageManagers.add(pkg.type);
  }

  // 2. Languages from file extension distributions
  const extensions = Object.keys(manifest.statistics.file_type_distribution);
  for (const ext of extensions) {
    if (ext === '.ts' || ext === '.tsx') {
      languages.add('TypeScript');
    } else if (ext === '.js' || ext === '.jsx') {
      languages.add('JavaScript');
    } else if (ext === '.json') {
      languages.add('JSON');
    } else if (ext === '.yml' || ext === '.yaml') {
      languages.add('YAML');
    } else if (ext === '.md') {
      languages.add('Markdown');
    }
  }

  // 3. Frameworks
  for (const comp of manifest.component_candidates) {
    if (comp.framework !== 'unknown') {
      frameworks.add(comp.framework);
    }
  }
  for (const config of manifest.config_files) {
    if (config.type === 'nextjs') {
      frameworks.add('Next.js');
    } else if (config.type === 'tailwind') {
      frameworks.add('Tailwind CSS');
    }
  }

  // 4. Config profiles
  for (const config of manifest.config_files) {
    configProfiles.add(config.type);
  }

  return {
    package_managers: Array.from(packageManagers).sort(),
    languages: Array.from(languages).sort(),
    frameworks: Array.from(frameworks).sort(),
    config_profiles: Array.from(configProfiles).sort()
  };
}

export function buildComponentsSummary(manifest: IntelligenceManifest): AiReadyContext['components_summary'] {
  const count = manifest.component_candidates.length;
  const frameworks = new Set<string>();
  const locations = new Set<string>();

  for (const comp of manifest.component_candidates) {
    if (comp.framework !== 'unknown') {
      frameworks.add(comp.framework);
    }
    
    // Roll up component locations to top level directories
    const dir = path.dirname(comp.path).replace(/\\/g, '/');
    if (dir && dir !== '.') {
      // Roll up e.g. "src/components/common" -> "src/components"
      const parts = dir.split('/');
      if (parts.length > 2) {
        locations.add(parts.slice(0, 2).join('/'));
      } else {
        locations.add(dir);
      }
    }
  }

  return {
    count,
    frameworks: Array.from(frameworks).sort(),
    locations: Array.from(locations).sort()
  };
}

export function buildEvidenceIndex(
  manifest: IntelligenceManifest,
  registry: InteractionRegistry,
  routesAndApis: AiReadyContext['routes_and_apis'],
  forms: AiReadyContext['forms']
): AiReadyContext['evidence_index'] {
  const routesFiles = new Set<string>();
  for (const route of routesAndApis) {
    for (const f of route.files) {
      routesFiles.add(f);
    }
  }

  const formsFiles = new Set<string>();
  for (const form of forms) {
    formsFiles.add(form.path);
  }

  const packagesFiles = manifest.package_files.map((p) => p.path);
  const configsFiles = manifest.config_files.map((c) => c.path);

  return {
    routes: Array.from(routesFiles).sort(),
    forms: Array.from(formsFiles).sort(),
    packages: packagesFiles.sort(),
    configs: configsFiles.sort()
  };
}
