/**
 * Synapse AI Agent - Core agent implementation
 * 
 * Features:
 * - Unified interface for conversations
 * - Tool execution
 * - Memory integration
 * - Token optimization
 */

import { v4 as uuidv4 } from 'crypto';
import { 
  Message, 
  Conversation, 
  AgentConfig, 
  ToolCall, 
  ToolResult,
  Skill 
} from '../types/index.js';
import { LLMClient, LLMResponse } from './llm-client.js';
import { MemoryManager } from './memory-manager.js';
import { TokenOptimizer } from './token-optimizer.js';
import { SkillRegistry } from './skill-registry.js';

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class Agent {
  private config: AgentConfig;
  private llmClient: LLMClient;
  private memoryManager: MemoryManager;
  private tokenOptimizer: TokenOptimizer;
  private skillRegistry: SkillRegistry;
  private conversations: Map<string, Conversation> = new Map();

  constructor(config: AgentConfig) {
    this.config = config;
    this.llmClient = new LLMClient(config.model);
    this.memoryManager = new MemoryManager(config.memory);
    this.tokenOptimizer = new TokenOptimizer();
    this.skillRegistry = new SkillRegistry();
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    await this.memoryManager.initialize();
    await this.skillRegistry.initialize();
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(
    userMessage: string,
    conversationId?: string
  ): Promise<AgentResponse> {
    // Get or create conversation
    const conversation = conversationId 
      ? this.getConversation(conversationId)
      : this.createConversation();

    // Add user message
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    conversation.messages.push(userMsg);

    // Get relevant memories
    const memoryContext = this.memoryManager.getRelevantContext(userMessage, 300);

    // Build messages for LLM
    const messages = this.buildMessages(conversation, memoryContext);

    // Optimize context
    const optimized = this.tokenOptimizer.optimizeContext(
      messages,
      this.config.model.maxTokens
    );

    // Get response from LLM
    const response = await this.llmClient.chat(optimized.messages);

    // Process any tool calls
    const { content, toolResults } = await this.processToolCalls(response.content);

    // Add assistant message
    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content,
      timestamp: new Date(),
    };
    conversation.messages.push(assistantMsg);
    conversation.updatedAt = new Date();

    // Save to memory if important
    await this.saveToMemory(userMessage, content);

    return {
      content,
      toolResults,
      usage: {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
      },
    };
  }

  /**
   * Stream a response
   */
  async *streamMessage(
    userMessage: string,
    conversationId?: string
  ): AsyncGenerator<string> {
    const conversation = conversationId 
      ? this.getConversation(conversationId)
      : this.createConversation();

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    conversation.messages.push(userMsg);

    const memoryContext = this.memoryManager.getRelevantContext(userMessage, 300);
    const messages = this.buildMessages(conversation, memoryContext);
    const optimized = this.tokenOptimizer.optimizeContext(
      messages,
      this.config.model.maxTokens
    );

    let fullContent = '';

    for await (const chunk of this.llmClient.streamChat(optimized.messages)) {
      if (!chunk.isComplete) {
        fullContent += chunk.content;
        yield chunk.content;
      }
    }

    // Save the complete message
    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: fullContent,
      timestamp: new Date(),
    };
    conversation.messages.push(assistantMsg);
    conversation.updatedAt = new Date();

    await this.saveToMemory(userMessage, fullContent);
  }

  /**
   * Build messages array for LLM
   */
  private buildMessages(
    conversation: Conversation,
    memoryContext: string
  ): Message[] {
    const messages: Message[] = [];

    // System prompt
    let systemPrompt = this.config.personality;
    
    if (memoryContext) {
      systemPrompt += `\n\n${memoryContext}`;
    }

    // Add available skills
    const skills = this.skillRegistry.getAllSkills();
    if (skills.length > 0) {
      systemPrompt += '\n\nAvailable tools:\n';
      for (const skill of skills) {
        systemPrompt += `- ${skill.name}: ${skill.description}\n`;
      }
    }

    messages.push({
      id: 'system',
      role: 'system',
      content: systemPrompt,
      timestamp: new Date(),
    });

    // Add conversation history
    messages.push(...conversation.messages);

    return messages;
  }

  /**
   * Process tool calls in the response
   */
  private async processToolCalls(content: string): Promise<{
    content: string;
    toolResults: ToolResult[];
  }> {
    const toolResults: ToolResult[] = [];
    
    // Simple tool call detection: look for patterns like /tool_name(args)
    const toolCallRegex = /\/([a-z_]+)\(([^)]*)\)/g;
    let match;
    let processedContent = content;

    while ((match = toolCallRegex.exec(content)) !== null) {
      const toolName = match[1];
      const argsStr = match[2];
      
      try {
        const args = argsStr ? JSON.parse(`{${argsStr}}`) : {};
        const result = await this.skillRegistry.executeSkill(toolName, args);
        
        toolResults.push({
          toolCallId: `${toolName}-${Date.now()}`,
          output: result.success ? JSON.stringify(result.data) : result.error || 'Error',
        });

        // Replace tool call with result in content
        processedContent = processedContent.replace(
          match[0],
          result.success ? `[${toolName} executed]` : `[${toolName} failed]`
        );
      } catch (error) {
        toolResults.push({
          toolCallId: `${toolName}-${Date.now()}`,
          output: error instanceof Error ? error.message : 'Unknown error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { content: processedContent, toolResults };
  }

  /**
   * Save important information to memory
   */
  private async saveToMemory(userMessage: string, assistantResponse: string): Promise<void> {
    // Simple heuristic: save if message contains keywords
    const importantKeywords = [
      'remember', 'my name is', 'i live in', 'i work at',
      'i like', 'i prefer', 'don\'t forget', 'important'
    ];

    const lowerMessage = userMessage.toLowerCase();
    const isImportant = importantKeywords.some(kw => lowerMessage.includes(kw));

    if (isImportant) {
      await this.memoryManager.saveMemory(
        `User: ${userMessage}\nAssistant: ${assistantResponse}`,
        'personal',
        0.7
      );
    }
  }

  /**
   * Create a new conversation
   */
  createConversation(): Conversation {
    const conversation: Conversation = {
      id: uuidv4(),
      messages: [],
      context: {
        systemPrompt: this.config.personality,
        maxTokens: this.config.model.maxTokens,
        currentTokens: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  getConversation(id: string): Conversation {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }
    return conversation;
  }

  /**
   * Get all conversations
   */
  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Delete a conversation
   */
  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  /**
   * Clear all conversations
   */
  clearConversations(): void {
    this.conversations.clear();
  }

  /**
   * Get token usage statistics
   */
  getUsageStats() {
    return this.llmClient.getUsageStats();
  }

  /**
   * Update agent configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    this.llmClient.updateConfig(config.model || {});
  }

  /**
   * Register a new skill
   */
  registerSkill(skill: Skill): void {
    this.skillRegistry.register(skill);
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return this.memoryManager.getStats();
  }
}

export default Agent;
