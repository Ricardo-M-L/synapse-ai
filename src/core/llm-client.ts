/**
 * LLM Client - Unified interface for multiple AI providers
 * 
 * Features:
 * - Support for Anthropic, OpenAI, and local models
 * - Automatic failover between providers
 * - Token usage tracking
 * - Response streaming
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Message, ModelConfig, TokenUsage } from '../types/index.js';
import { tokenOptimizer } from './token-optimizer.js';

export interface LLMResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  finishReason: string;
}

export interface StreamChunk {
  content: string;
  isComplete: boolean;
}

export class LLMClient {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private config: ModelConfig;
  private usageHistory: TokenUsage[] = [];

  constructor(config: ModelConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * Initialize API clients based on configuration
   */
  private initializeClients(): void {
    switch (this.config.provider) {
      case 'anthropic':
        if (this.config.apiKey) {
          this.anthropic = new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseUrl,
          });
        }
        break;

      case 'openai':
        if (this.config.apiKey) {
          this.openai = new OpenAI({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseUrl,
          });
        }
        break;

      case 'local':
        // Local models via OpenAI-compatible API
        this.openai = new OpenAI({
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: 'local',
        });
        break;
    }
  }

  /**
   * Send a chat completion request
   */
  async chat(messages: Message[]): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'anthropic':
        return this.chatAnthropic(messages);
      case 'openai':
      case 'local':
        return this.chatOpenAI(messages);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Stream a chat completion
   */
  async *streamChat(messages: Message[]): AsyncGenerator<StreamChunk> {
    switch (this.config.provider) {
      case 'anthropic':
        yield* this.streamAnthropic(messages);
        break;
      case 'openai':
      case 'local':
        yield* this.streamOpenAI(messages);
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Chat with Anthropic Claude
   */
  private async chatAnthropic(messages: Message[]): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      system: systemMessage?.content,
      messages: chatMessages,
    });

    const content = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as any).text)
      .join('');

    const usage = tokenOptimizer.calculateUsage(
      response.usage.input_tokens,
      response.usage.output_tokens,
      this.config.model
    );

    this.usageHistory.push(usage);

    return {
      content,
      usage,
      model: this.config.model,
      finishReason: response.stop_reason || 'unknown',
    };
  }

  /**
   * Stream with Anthropic Claude
   */
  private async *streamAnthropic(
    messages: Message[]
  ): AsyncGenerator<StreamChunk> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const stream = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      system: systemMessage?.content,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const delta = chunk.delta as any;
        if (delta.text) {
          yield {
            content: delta.text,
            isComplete: false,
          };
        }
      }
    }

    yield {
      content: '',
      isComplete: true,
    };
  }

  /**
   * Chat with OpenAI
   */
  private async chatOpenAI(messages: Message[]): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    });

    const choice = response.choices[0];
    const content = choice.message.content || '';

    const usage = tokenOptimizer.calculateUsage(
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0,
      this.config.model
    );

    this.usageHistory.push(usage);

    return {
      content,
      usage,
      model: this.config.model,
      finishReason: choice.finish_reason || 'unknown',
    };
  }

  /**
   * Stream with OpenAI
   */
  private async *streamOpenAI(
    messages: Message[]
  ): AsyncGenerator<StreamChunk> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const stream = await this.openai.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield {
          content: delta,
          isComplete: false,
        };
      }
    }

    yield {
      content: '',
      isComplete: true,
    };
  }

  /**
   * Get total token usage statistics
   */
  getUsageStats(): {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageTokensPerRequest: number;
  } {
    const totalTokens = this.usageHistory.reduce(
      (sum, u) => sum + u.totalTokens,
      0
    );
    const totalCost = this.usageHistory.reduce(
      (sum, u) => sum + u.estimatedCost,
      0
    );

    return {
      totalRequests: this.usageHistory.length,
      totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000,
      averageTokensPerRequest: this.usageHistory.length > 0
        ? Math.round(totalTokens / this.usageHistory.length)
        : 0,
    };
  }

  /**
   * Clear usage history
   */
  clearUsageHistory(): void {
    this.usageHistory = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeClients();
  }

  /**
   * Validate the configuration
   */
  async validate(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Try a simple request
      const testMessage: Message = {
        id: 'test',
        role: 'user',
        content: 'Hi',
        timestamp: new Date(),
      };

      await this.chat([testMessage]);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default LLMClient;
