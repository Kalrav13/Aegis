import { AiReadyContext } from '@testlens/contracts';

export function buildUnderstandingPrompt(context: AiReadyContext): string {
  return `You are an expert Principal AI Architect and Senior QA SDET. Your task is to analyze a structured codebase context and generate a deterministic business understanding of the repository.

You must output a single JSON object conforming exactly to the following JSON schema:
{
  "applicationPurpose": {
    "summary": "Descriptive summary of what the application does, its architecture, and tech stack.",
    "confidenceScore": 0.0 to 1.0,
    "evidence": ["array", "of", "file", "paths"]
  },
  "targetUsers": [
    {
      "role": "User role name (e.g. Admin, Customer)",
      "description": "Why this role is identified",
      "confidenceScore": 0.0 to 1.0,
      "evidence": ["array", "of", "route", "or", "component", "paths"]
    }
  ],
  "businessDomains": [
    {
      "name": "Domain name (e.g. E-Commerce, Auth, SaaS)",
      "description": "Explanation of domain presence",
      "confidenceScore": 0.0 to 1.0,
      "evidence": ["array", "of", "paths"]
    }
  ],
  "coreWorkflows": [
    {
      "name": "Workflow name (e.g. User login, Checkout flow)",
      "description": "What the workflow accomplishes",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "associatedRoutes": ["/route1", "/route2"],
      "associatedApis": ["/api/route1"],
      "confidenceScore": 0.0 to 1.0,
      "evidence": ["array", "of", "paths"]
    }
  ],
  "highRiskWorkflows": [
    {
      "name": "High risk workflow/action name (e.g. Password Reset, Payment Processing)",
      "riskFactor": "Explain the risk (e.g. Data loss, Security bypass)",
      "mitigationFocus": "Area to focus QA testing",
      "confidenceScore": 0.0 to 1.0,
      "evidence": ["array", "of", "paths"]
    }
  ]
}

CRITICAL RULES:
1. NO HALLUCINATIONS: You must only cite file paths that are explicitly listed in the provided context directories, routes, forms, configs, or package files. Do not invent any file paths.
2. EVIDENCE REQUIRED: Every conclusion must contain at least one valid path in its "evidence" list. If you cannot find evidence for an inference, you must omit that inference.
3. STRICT CONFIDENCE SCORING: Follow these Confidence Scoring Rules:
   - High Confidence (0.85 - 1.00): Explicit matches; configuration file confirms framework profile; route paths explicitly name workflow.
   - Medium Confidence (0.50 - 0.84): Heuristic keyword matches; route matches related term.
   - Low Confidence (< 0.50): Boilerplate configurations, speculative folder matches.
4. ONLY RETURN VALID JSON: Do not wrap your response in markdown formatting or write conversational text. Return the raw JSON object.

<CONTEXT>
${JSON.stringify(context, null, 2)}
</CONTEXT>

Analyze the context above and produce the business understanding JSON.`;
}
