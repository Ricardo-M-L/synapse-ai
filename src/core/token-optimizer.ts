/**
 * Token Optimizer - Core module for reducing token consumption
 * 
 * This module implements several strategies to minimize token usage:
 * 1. Context compression - Summarize old messages
 * 2. Semantic chunking - Group related messages
 * 3. Smart truncation - Remove less important content
 * 4. Caching - Avoid repetitive prompts
 */

import { Message, Conversation, ContextWindow, TokenUsage } from '../types/index.js';

export interface OptimizationResult {
  messages: Message[];
  tokensSaved: number;
  strategy: string;
}

export class TokenOptimizer {
  private cache: Map<string, string> = new Map();
  private readonly DEFAULT_MAX_TOKENS = 4000;
  private readonly SUMMARY_THRESHOLD = 2000;
  private readonly CHARS_PER_TOKEN = 4;

  /**
   * Estimate token count from text
   * Simple estimation: ~4 characters per token for English
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Calculate total tokens in a conversation
   */
  calculateConversationTokens(messages: Message[]): number {
    return messages.reduce((total, msg) => {
      return total + this.estimateTokens(msg.content);
    }, 0);
  }

  /**
   * Optimize conversation context to fit within token limit
   */
  optimizeContext(
    messages: Message[],
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): OptimizationResult {
    const currentTokens = this.calculateConversationTokens(messages);
    
    if (currentTokens <= maxTokens) {
      return {
        messages,
        tokensSaved: 0,
        strategy: 'none'
      };
    }

    // Try different strategies in order of preference
    const strategies = [
      () => this.compressWithSummarization(messages, maxTokens),
      () => this.removeOldMessages(messages, maxTokens),
      () => this.truncateMessages(messages, maxTokens),
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result.tokensSaved > 0) {
        return result;
      }
    }

    return {
      messages,
      tokensSaved: 0,
      strategy: 'failed'
    };
  }

  /**
   * Strategy 1: Compress old messages using summarization
   */
  private compressWithSummarization(
    messages: Message[],
    maxTokens: number
  ): OptimizationResult {
    if (messages.length < 4) {
      return { messages, tokensSaved: 0, strategy: 'none' };
    }

    // Keep the most recent messages intact
    const recentCount = Math.min(3, Math.floor(messages.length * 0.3));
    const recentMessages = messages.slice(-recentCount);
    const oldMessages = messages.slice(0, -recentCount);

    // Create a summary of old messages
    const summary = this.summarizeMessages(oldMessages);
    const summaryMessage: Message = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: `[Previous conversation summary: ${summary}]`,
      timestamp: new Date(),
    };

    const optimizedMessages = [summaryMessage, ...recentMessages];
    const newTokens = this.calculateConversationTokens(optimizedMessages);
    const oldTokens = this.calculateConversationTokens(messages);

    if (newTokens <= maxTokens) {
      return {
        messages: optimizedMessages,
        tokensSaved: oldTokens - newTokens,
        strategy: 'summarization'
      };
    }

    return { messages, tokensSaved: 0, strategy: 'none' };
  }

  /**
   * Strategy 2: Remove oldest messages
   */
  private removeOldMessages(
    messages: Message[],
    maxTokens: number
  ): OptimizationResult {
    let optimized = [...messages];
    let tokens = this.calculateConversationTokens(optimized);

    // Remove oldest non-system messages until under limit
    while (tokens > maxTokens && optimized.length > 2) {
      const firstNonSystem = optimized.findIndex(m => m.role !== 'system');
      if (firstNonSystem === -1) break;
      
      const removed = optimized.splice(firstNonSystem, 1)[0];
      tokens -= this.estimateTokens(removed.content);
    }

    const tokensSaved = this.calculateConversationTokens(messages) - tokens;
    
    return {
      messages: optimized,
      tokensSaved,
      strategy: 'removal'
    };
  }

  /**
   * Strategy 3: Truncate long messages
   */
  private truncateMessages(
    messages: Message[],
    maxTokens: number
  ): OptimizationResult {
    const optimized = messages.map(msg => {
      const msgTokens = this.estimateTokens(msg.content);
      const maxMsgTokens = Math.floor(maxTokens / messages.length);
      
      if (msgTokens > maxMsgTokens) {
        const maxChars = maxMsgTokens * this.CHARS_PER_TOKEN;
        return {
          ...msg,
          content: msg.content.substring(0, maxChars) + '... [truncated]'
        };
      }
      return msg;
    });

    const tokensSaved = 
      this.calculateConversationTokens(messages) - 
      this.calculateConversationTokens(optimized);

    return {
      messages: optimized,
      tokensSaved,
      strategy: 'truncation'
    };
  }

  /**
   * Create a summary of multiple messages
   */
  private summarizeMessages(messages: Message[]): string {
    const keyPoints = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => {
        // Extract first sentence or first 50 chars
        const firstSentence = m.content.split(/[.!?]/)[0];
        return firstSentence.length > 50 
          ? firstSentence.substring(0, 50) + '...'
          : firstSentence;
      });

    return keyPoints.join(' | ');
  }

  /**
   * Cache a response for similar future queries
   */
  cacheResponse(key: string, response: string): void {
    // Simple cache with max 100 entries
    if (this.cache.size >= 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, response);
  }

  /**
   * Get cached response if exists
   */
  getCachedResponse(key: string): string | undefined {
    return this.cache.get(key);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Create an optimized system prompt
   */
  createOptimizedSystemPrompt(basePrompt: string): string {
    // Remove unnecessary whitespace and comments
    return basePrompt
      .replace(/\s+/g, ' ')
      .replace(/<!--.*?-->/g, '')
      .trim();
  }

  /**
   * Calculate token usage statistics
   */
  calculateUsage(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): TokenUsage {
    // Rough cost estimates per 1K tokens
    const costs: Record<string, { input: number; output: number }> = {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    };

    const cost = costs[model] || { input: 0.01, output: 0.03 };
    const estimatedCost = 
      (inputTokens / 1000) * cost.input + 
      (outputTokens / 1000) * cost.output;

    return {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    };
  }
}

export const tokenOptimizer = new TokenOptimizer();
