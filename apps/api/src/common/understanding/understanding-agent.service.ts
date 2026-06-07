import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AiReadyContext, RepositoryUnderstanding } from '@testlens/contracts';
import { buildUnderstandingPrompt } from './prompt-builder';
import { validateAndSanitizeResponse } from './response-validator';

@Injectable()
export class UnderstandingAgentService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Evaluates the codebase context, queries the Gemini model, and returns a verified understanding payload.
   */
  public async analyzeRepository(context: AiReadyContext): Promise<RepositoryUnderstanding> {
    const prompt = buildUnderstandingPrompt(context);
    
    // Call Gemini API integration gateway
    const rawResult = await this.aiService.generateJson(prompt);

    // Parse, Zod validate, and filter evidence path connections
    return validateAndSanitizeResponse(rawResult, context);
  }
}
