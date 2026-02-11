import axios from 'axios';

/**
 * Integration with external AI services for game move suggestions
 */

interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

interface AnthropicConfig {
  apiKey: string;
  model?: string;
}

/**
 * OpenAI GPT-4 integration for strategic game analysis
 */
export class OpenAIGameAI {
  private apiKey: string;
  private model: string;
  private baseURL: string = 'https://api.openai.com/v1';

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4';
  }

  async suggestMove(gameState: any, gameRules: string): Promise<any> {
    try {
      const prompt = this.buildPrompt(gameState, gameRules);
      
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert game AI strategist. Analyze the game state and suggest the optimal move. Return only valid JSON with the move.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more deterministic responses
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { move: content };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  private buildPrompt(gameState: any, gameRules: string): string {
    return `
Game Rules:
${gameRules}

Current Game State:
${JSON.stringify(gameState, null, 2)}

Analyze the current game state and suggest the optimal move. Consider:
1. Immediate tactical advantages
2. Long-term strategic positioning
3. Opponent's possible responses
4. Win conditions

Return your move as JSON in this format:
{
  "move": { ... },
  "reasoning": "brief explanation"
}
    `.trim();
  }
}

/**
 * Anthropic Claude integration
 */
export class AnthropicGameAI {
  private apiKey: string;
  private model: string;
  private baseURL: string = 'https://api.anthropic.com/v1';

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-opus-20240229';
  }

  async suggestMove(gameState: any, gameRules: string): Promise<any> {
    try {
      const prompt = this.buildPrompt(gameState, gameRules);
      
      const response = await axios.post(
        `${this.baseURL}/messages`,
        {
          model: this.model,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { move: content };
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  private buildPrompt(gameState: any, gameRules: string): string {
    return `
Game Rules:
${gameRules}

Current Game State:
${JSON.stringify(gameState, null, 2)}

Analyze and suggest the optimal move. Return JSON format:
{
  "move": { ... },
  "reasoning": "explanation"
}
    `.trim();
  }
}

/**
 * Hybrid approach: Use AI for evaluation, algorithms for search
 */
export class HybridAI {
  private openAI?: OpenAIGameAI;
  private anthropic?: AnthropicGameAI;

  constructor(openAIConfig?: OpenAIConfig, anthropicConfig?: AnthropicConfig) {
    if (openAIConfig) {
      this.openAI = new OpenAIGameAI(openAIConfig);
    }
    if (anthropicConfig) {
      this.anthropic = new AnthropicGameAI(anthropicConfig);
    }
  }

  async evaluatePosition(gameState: any, gameRules: string): Promise<number> {
    // Use AI to evaluate position quality
    // Returns a score from -100 to 100
    try {
      const ai = this.openAI || this.anthropic;
      if (!ai) {
        return 0; // No AI configured
      }

      const suggestion = await ai.suggestMove(gameState, gameRules);
      // Extract evaluation from AI response or use as heuristic
      return 50; // Placeholder - implement based on AI response
    } catch (error) {
      console.error('Hybrid AI evaluation error:', error);
      return 0;
    }
  }
}
