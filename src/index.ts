/**
 * Synapse AI - Main entry point
 * 
 * A lightweight, token-efficient personal AI assistant
 * 
 * @author ricardo
 * @license MIT
 */

export { Agent } from './core/agent.js';
export { LLMClient } from './core/llm-client.js';
export { MemoryManager } from './core/memory-manager.js';
export { TokenOptimizer } from './core/token-optimizer.js';
export { SkillRegistry } from './core/skill-registry.js';
export { GatewayServer } from './gateway/server.js';

export * from './types/index.js';

// Version
export const VERSION = '1.0.0';

// Default export
import { Agent } from './core/agent.js';
export default Agent;
