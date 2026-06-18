import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy-key',
    baseURL: 'https://api.groq.com/openai/v1',
  });

  async generateMeetingInsights(transcript: string) {
    const response = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',

      messages: [
        {
          role: 'system',
          content: `
Analyze this meeting transcript.

Return ONLY valid JSON:

{
  "summary": "",
  "actionItems": [],
  "keyDecisions": [],
  "suggestedTitle": "",
  "tags": []
}
`,
        },

        {
          role: 'user',
          content: transcript,
        },
      ],

      temperature: 0.2,
    });

    return response.choices[0].message.content;
  }
}
