/**
 * Memory Manager - Efficient memory system for Synapse AI
 * 
 * Features:
 * - Hierarchical memory storage
 * - Importance-based retention
 * - Vector-based semantic search (simplified)
 * - Automatic cleanup of old memories
 */

import { MemoryEntry, MemoryConfig } from '../types/index.js';
import { tokenOptimizer } from './token-optimizer.js';
import * as fs from 'fs-extra';
import * as path from 'path';

export class MemoryManager {
  private memories: Map<string, MemoryEntry> = new Map();
  private config: MemoryConfig;
  private storagePath: string;
  private readonly DEFAULT_CATEGORIES = [
    'personal',
    'preference',
    'fact',
    'task',
    'conversation'
  ];

  constructor(config?: Partial<MemoryConfig>, storagePath?: string) {
    this.config = {
      enabled: true,
      maxEntries: 1000,
      categories: this.DEFAULT_CATEGORIES,
      ...config,
    };
    this.storagePath = storagePath || path.join(process.cwd(), '.synapse', 'memory.json');
  }

  /**
   * Initialize the memory manager
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      await fs.ensureDir(path.dirname(this.storagePath));
      
      if (await fs.pathExists(this.storagePath)) {
        const data = await fs.readJson(this.storagePath);
        this.memories = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load memories:', error);
    }
  }

  /**
   * Save a new memory
   */
  async saveMemory(
    content: string,
    category: string = 'general',
    importance: number = 0.5
  ): Promise<MemoryEntry> {
    if (!this.config.enabled) {
      throw new Error('Memory is disabled');
    }

    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      category,
      importance: Math.max(0, Math.min(1, importance)),
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    this.memories.set(entry.id, entry);
    
    // Cleanup if over limit
    if (this.memories.size > this.config.maxEntries) {
      await this.cleanupOldMemories();
    }

    await this.persist();
    return entry;
  }

  /**
   * Retrieve memories by category
   */
  getMemoriesByCategory(category: string, limit: number = 10): MemoryEntry[] {
    return Array.from(this.memories.values())
      .filter(m => m.category === category)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Search memories by keyword
   */
  searchMemories(query: string, limit: number = 5): MemoryEntry[] {
    const keywords = query.toLowerCase().split(/\s+/);
    
    const scored = Array.from(this.memories.values()).map(memory => {
      const content = memory.content.toLowerCase();
      let score = 0;
      
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          score += 1;
          // Bonus for exact matches at word boundaries
          if (new RegExp(`\\b${keyword}\\b`).test(content)) {
            score += 0.5;
          }
        }
      }
      
      // Weight by importance
      score *= (1 + memory.importance);
      
      return { memory, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  /**
   * Get relevant memories for a conversation context
   */
  getRelevantContext(query: string, maxTokens: number = 500): string {
    const relevant = this.searchMemories(query, 10);
    
    if (relevant.length === 0) {
      return '';
    }

    let context = 'Relevant information from memory:\n';
    let currentTokens = tokenOptimizer.estimateTokens(context);

    for (const memory of relevant) {
      const memoryText = `- ${memory.content}\n`;
      const memoryTokens = tokenOptimizer.estimateTokens(memoryText);
      
      if (currentTokens + memoryTokens > maxTokens) {
        break;
      }
      
      context += memoryText;
      currentTokens += memoryTokens;
      
      // Update last accessed
      memory.lastAccessed = new Date();
    }

    return context;
  }

  /**
   * Update memory importance based on access patterns
   */
  async updateImportance(memoryId: string, delta: number): Promise<void> {
    const memory = this.memories.get(memoryId);
    if (memory) {
      memory.importance = Math.max(0, Math.min(1, memory.importance + delta));
      await this.persist();
    }
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    const deleted = this.memories.delete(memoryId);
    if (deleted) {
      await this.persist();
    }
    return deleted;
  }

  /**
   * Clear all memories
   */
  async clearAll(): Promise<void> {
    this.memories.clear();
    await this.persist();
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    averageImportance: number;
  } {
    const entries = Array.from(this.memories.values());
    const byCategory: Record<string, number> = {};
    
    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    }

    const averageImportance = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.importance, 0) / entries.length
      : 0;

    return {
      total: entries.length,
      byCategory,
      averageImportance: Math.round(averageImportance * 100) / 100,
    };
  }

  /**
   * Cleanup old/low-importance memories
   */
  private async cleanupOldMemories(): Promise<void> {
    const entries = Array.from(this.memories.entries());
    
    // Sort by importance * recency
    const now = Date.now();
    const scored = entries.map(([id, memory]) => {
      const age = now - memory.createdAt.getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-daysOld / 30); // Decay over 30 days
      const score = memory.importance * recencyScore;
      return { id, score };
    });

    // Remove lowest scoring entries until under limit
    scored.sort((a, b) => a.score - b.score);
    
    const toRemove = scored.slice(0, scored.length - this.config.maxEntries);
    for (const { id } of toRemove) {
      this.memories.delete(id);
    }
  }

  /**
   * Persist memories to disk
   */
  private async persist(): Promise<void> {
    try {
      const data = Object.fromEntries(this.memories);
      await fs.writeJson(this.storagePath, data, { spaces: 2 });
    } catch (error) {
      console.error('Failed to persist memories:', error);
    }
  }

  /**
   * Export memories to markdown format
   */
  async exportToMarkdown(outputPath: string): Promise<void> {
    const entries = Array.from(this.memories.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let markdown = '# Synapse AI Memory Export\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `Total memories: ${entries.length}\n\n`;

    // Group by category
    const byCategory: Record<string, MemoryEntry[]> = {};
    for (const entry of entries) {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry);
    }

    for (const [category, catEntries] of Object.entries(byCategory)) {
      markdown += `## ${category}\n\n`;
      for (const entry of catEntries) {
        markdown += `- **${entry.createdAt.toISOString()}** (importance: ${entry.importance})\n`;
        markdown += `  ${entry.content}\n\n`;
      }
    }

    await fs.writeFile(outputPath, markdown);
  }
}

export const memoryManager = new MemoryManager();
