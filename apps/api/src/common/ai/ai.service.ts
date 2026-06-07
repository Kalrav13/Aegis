import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly config: AppConfigService) {
    const apiKey = this.config.geminiApiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Calls the Gemini API with JSON mode enabled and returns the raw string response.
   */
  public async generateJson(prompt: string, modelName: string = 'gemini-1.5-flash'): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text) {
        throw new Error('Gemini API returned an empty response text.');
      }
      return text;
    } catch (error: any) {
      console.error('Gemini API integration layer failed:', error.message);
      throw error;
    }
  }
}
