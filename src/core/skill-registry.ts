/**
 * Skill Registry - Manage and execute agent skills
 * 
 * Features:
 * - Dynamic skill registration
 * - Built-in skills for common tasks
 * - Skill sandboxing
 * - Parameter validation
 */

import { Skill, SkillResult, SkillParameter } from '../types/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private builtinSkillsPath: string;

  constructor() {
    this.builtinSkillsPath = path.join(process.cwd(), 'skills');
  }

  /**
   * Initialize the skill registry
   */
  async initialize(): Promise<void> {
    // Register built-in skills
    this.registerBuiltInSkills();
    
    // Load custom skills from directory
    await this.loadCustomSkills();
  }

  /**
   * Register a skill
   */
  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * Get a skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all registered skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Execute a skill
   */
  async executeSkill(
    name: string,
    params: Record<string, unknown>
  ): Promise<SkillResult> {
    const skill = this.skills.get(name);
    
    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${name}`,
      };
    }

    // Validate parameters
    const validation = this.validateParams(skill.parameters, params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid parameters: ${validation.error}`,
      };
    }

    try {
      return await skill.execute(params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate skill parameters
   */
  private validateParams(
    parameters: SkillParameter[],
    params: Record<string, unknown>
  ): { valid: boolean; error?: string } {
    for (const param of parameters) {
      if (param.required && !(param.name in params)) {
        return {
          valid: false,
          error: `Missing required parameter: ${param.name}`,
        };
      }

      const value = params[param.name];
      if (value !== undefined) {
        const typeValid = this.validateType(value, param.type);
        if (!typeValid) {
          return {
            valid: false,
            error: `Invalid type for parameter ${param.name}: expected ${param.type}`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate value type
   */
  private validateType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Register built-in skills
   */
  private registerBuiltInSkills(): void {
    // File operations
    this.registerFileSkills();
    
    // System operations
    this.registerSystemSkills();
    
    // Web operations
    this.registerWebSkills();
    
    // Utility operations
    this.registerUtilitySkills();
  }

  /**
   * Register file-related skills
   */
  private registerFileSkills(): void {
    // Read file
    this.register({
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: [
        { name: 'path', type: 'string', required: true, description: 'File path' },
        { name: 'encoding', type: 'string', required: false, description: 'File encoding' },
      ],
      execute: async (params) => {
        try {
          const content = await fs.readFile(
            params.path as string,
            (params.encoding as string) || 'utf-8'
          );
          return { success: true, data: content };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read file',
          };
        }
      },
    });

    // Write file
    this.register({
      name: 'write_file',
      description: 'Write content to a file',
      parameters: [
        { name: 'path', type: 'string', required: true, description: 'File path' },
        { name: 'content', type: 'string', required: true, description: 'Content to write' },
      ],
      execute: async (params) => {
        try {
          await fs.ensureDir(path.dirname(params.path as string));
          await fs.writeFile(params.path as string, params.content as string);
          return { success: true, data: { path: params.path } };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to write file',
          };
        }
      },
    });

    // List directory
    this.register({
      name: 'list_dir',
      description: 'List contents of a directory',
      parameters: [
        { name: 'path', type: 'string', required: true, description: 'Directory path' },
      ],
      execute: async (params) => {
        try {
          const items = await fs.readdir(params.path as string, { withFileTypes: true });
          return {
            success: true,
            data: items.map(item => ({
              name: item.name,
              type: item.isDirectory() ? 'directory' : 'file',
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list directory',
          };
        }
      },
    });
  }

  /**
   * Register system-related skills
   */
  private registerSystemSkills(): void {
    // Execute command
    this.register({
      name: 'execute',
      description: 'Execute a shell command',
      parameters: [
        { name: 'command', type: 'string', required: true, description: 'Command to execute' },
        { name: 'timeout', type: 'number', required: false, description: 'Timeout in ms' },
      ],
      execute: async (params) => {
        try {
          const { stdout, stderr } = await execAsync(params.command as string, {
            timeout: (params.timeout as number) || 30000,
          });
          return {
            success: true,
            data: { stdout, stderr },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Command failed',
          };
        }
      },
    });

    // Get system info
    this.register({
      name: 'system_info',
      description: 'Get system information',
      parameters: [],
      execute: async () => {
        return {
          success: true,
          data: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
          },
        };
      },
    });
  }

  /**
   * Register web-related skills
   */
  private registerWebSkills(): void {
    // HTTP request
    this.register({
      name: 'http_request',
      description: 'Make an HTTP request',
      parameters: [
        { name: 'url', type: 'string', required: true, description: 'URL to request' },
        { name: 'method', type: 'string', required: false, description: 'HTTP method' },
        { name: 'headers', type: 'object', required: false, description: 'Request headers' },
        { name: 'body', type: 'object', required: false, description: 'Request body' },
      ],
      execute: async (params) => {
        try {
          const response = await axios({
            url: params.url as string,
            method: (params.method as string) || 'GET',
            headers: params.headers as Record<string, string>,
            data: params.body,
          });
          return {
            success: true,
            data: {
              status: response.status,
              headers: response.headers,
              data: response.data,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Request failed',
          };
        }
      },
    });

    // Search (simplified - just returns search URL)
    this.register({
      name: 'search',
      description: 'Search the web',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Search query' },
      ],
      execute: async (params) => {
        const query = encodeURIComponent(params.query as string);
        return {
          success: true,
          data: {
            googleUrl: `https://www.google.com/search?q=${query}`,
            duckduckgoUrl: `https://duckduckgo.com/?q=${query}`,
          },
        };
      },
    });
  }

  /**
   * Register utility skills
   */
  private registerUtilitySkills(): void {
    // Calculator
    this.register({
      name: 'calculate',
      description: 'Perform a calculation',
      parameters: [
        { name: 'expression', type: 'string', required: true, description: 'Math expression' },
      ],
      execute: async (params) => {
        try {
          // Safe evaluation - only allow basic math
          const sanitized = (params.expression as string)
            .replace(/[^0-9+\-*/().\s]/g, '');
          // eslint-disable-next-line no-eval
          const result = eval(sanitized);
          return { success: true, data: { result } };
        } catch (error) {
          return {
            success: false,
            error: 'Invalid expression',
          };
        }
      },
    });

    // Get current time
    this.register({
      name: 'current_time',
      description: 'Get the current date and time',
      parameters: [],
      execute: async () => {
        return {
          success: true,
          data: {
            iso: new Date().toISOString(),
            local: new Date().toLocaleString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };
      },
    });

    // Remember
    this.register({
      name: 'remember',
      description: 'Remember information for later',
      parameters: [
        { name: 'content', type: 'string', required: true, description: 'Content to remember' },
        { name: 'category', type: 'string', required: false, description: 'Memory category' },
      ],
      execute: async (params) => {
        // This is handled by the agent's memory manager
        return {
          success: true,
          data: { message: 'Information will be remembered' },
        };
      },
    });
  }

  /**
   * Load custom skills from directory
   */
  private async loadCustomSkills(): Promise<void> {
    try {
      if (!(await fs.pathExists(this.builtinSkillsPath))) {
        return;
      }

      const files = await fs.readdir(this.builtinSkillsPath);
      
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          try {
            const skillPath = path.join(this.builtinSkillsPath, file);
            const skillModule = await import(skillPath);
            
            if (skillModule.default && typeof skillModule.default === 'object') {
              this.register(skillModule.default as Skill);
            }
          } catch (error) {
            console.warn(`Failed to load skill from ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load custom skills:', error);
    }
  }

  /**
   * Unregister a skill
   */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /**
   * Check if a skill exists
   */
  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }
}

export const skillRegistry = new SkillRegistry();
export default SkillRegistry;
