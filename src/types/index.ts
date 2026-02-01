// Core type definitions for Synapse AI

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  messages: Message[];
  context: ContextWindow;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContextWindow {
  systemPrompt: string;
  maxTokens: number;
  currentTokens: number;
  summary?: string;
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'local';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface Skill {
  name: string;
  description: string;
  parameters: SkillParameter[];
  execute: (params: Record<string, unknown>) => Promise<SkillResult>;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ChannelConfig {
  type: ChannelType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export type ChannelType = 
  | 'telegram' 
  | 'discord' 
  | 'slack' 
  | 'whatsapp' 
  | 'web' 
  | 'cli';

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  importance: number;
  createdAt: Date;
  lastAccessed: Date;
}

export interface AgentConfig {
  name: string;
  personality: string;
  skills: string[];
  model: ModelConfig;
  memory: MemoryConfig;
  channels: ChannelConfig[];
}

export interface MemoryConfig {
  enabled: boolean;
  maxEntries: number;
  categories: string[];
}

export interface GatewayConfig {
  port: number;
  host: string;
  auth: AuthConfig;
  rateLimit: RateLimitConfig;
}

export interface AuthConfig {
  type: 'none' | 'token' | 'password';
  secret?: string;
}

export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
}

export interface Session {
  id: string;
  userId: string;
  conversationId: string;
  channel: ChannelType;
  createdAt: Date;
  lastActivity: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: string;
}
