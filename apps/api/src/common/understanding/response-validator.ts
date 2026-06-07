import { AiReadyContext, RepositoryUnderstanding, validateUnderstanding } from '@testlens/contracts';

export function validateAndSanitizeResponse(
  rawJson: string,
  context: AiReadyContext
): RepositoryUnderstanding {
  // 1. Parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    throw new Error(`Failed to parse LLM response as JSON: ${err.message}`);
  }

  // 2. Validate Zod Contract
  const understanding = validateUnderstanding(parsed);

  // 3. Build a Set of all valid paths from the Context
  const validPaths = new Set<string>();
  
  if (context.evidence_index) {
    const keys = ['routes', 'forms', 'packages', 'configs'] as const;
    for (const key of keys) {
      if (context.evidence_index[key]) {
        context.evidence_index[key].forEach((p) => validPaths.add(p));
      }
    }
  }

  // Flatten routes files
  for (const route of context.routes_and_apis) {
    route.files.forEach((f) => validPaths.add(f));
  }

  // Flatten form paths
  for (const form of context.forms) {
    validPaths.add(form.path);
  }

  // Sanitize helper function
  const sanitizeEvidence = (evidence: string[]): string[] => {
    return evidence.filter((p) => validPaths.has(p));
  };

  // 4. Sanitize evidence for each inferred section
  understanding.applicationPurpose.evidence = sanitizeEvidence(understanding.applicationPurpose.evidence);
  if (understanding.applicationPurpose.evidence.length === 0) {
    // Fallback if empty to index.tsx or package.json
    const defaultFallback = context.evidence_index.packages[0] || 'package.json';
    understanding.applicationPurpose.evidence = [defaultFallback];
  }

  understanding.targetUsers = understanding.targetUsers
    .map((user) => {
      user.evidence = sanitizeEvidence(user.evidence);
      return user;
    })
    .filter((user) => user.evidence.length > 0);

  understanding.businessDomains = understanding.businessDomains
    .map((domain) => {
      domain.evidence = sanitizeEvidence(domain.evidence);
      return domain;
    })
    .filter((domain) => domain.evidence.length > 0);

  understanding.coreWorkflows = understanding.coreWorkflows
    .map((wf) => {
      wf.evidence = sanitizeEvidence(wf.evidence);
      return wf;
    })
    .filter((wf) => wf.evidence.length > 0);

  understanding.highRiskWorkflows = understanding.highRiskWorkflows
    .map((hr) => {
      hr.evidence = sanitizeEvidence(hr.evidence);
      return hr;
    })
    .filter((hr) => hr.evidence.length > 0);

  return understanding;
}
