#!/usr/bin/env node
/**
 * Synapse AI CLI
 * 
 * Command-line interface for interacting with the agent
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { Agent } from './core/agent.js';
import { AgentConfig, ModelConfig } from './types/index.js';
import { GatewayServer } from './gateway/server.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();

// Default configuration
const DEFAULT_CONFIG: AgentConfig = {
  name: 'Synapse',
  personality: `You are Synapse, a helpful AI assistant. You are efficient, concise, and focused on providing accurate information while minimizing token usage.`,
  skills: [],
  model: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    maxTokens: 1024,
    temperature: 0.7,
  },
  memory: {
    enabled: true,
    maxEntries: 1000,
    categories: ['personal', 'preference', 'fact', 'task'],
  },
  channels: [],
};

// Config path
const CONFIG_DIR = path.join(process.env.HOME || process.cwd(), '.synapse');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Load configuration
 */
async function loadConfig(): Promise<AgentConfig> {
  try {
    if (await fs.pathExists(CONFIG_PATH)) {
      const saved = await fs.readJson(CONFIG_PATH);
      return { ...DEFAULT_CONFIG, ...saved };
    }
  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not load config, using defaults'));
  }
  return DEFAULT_CONFIG;
}

/**
 * Save configuration
 */
async function saveConfig(config: AgentConfig): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

// Program setup
program
  .name('synapse')
  .description('Synapse AI - A lightweight, token-efficient personal AI assistant')
  .version('1.0.0');

// Chat command
program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-m, --message <message>', 'Send a single message')
  .option('-s, --stream', 'Stream the response', false)
  .action(async (options) => {
    const config = await loadConfig();
    const agent = new Agent(config);
    await agent.initialize();

    if (options.message) {
      // Single message mode
      const spinner = ora('Thinking...').start();
      
      try {
        const response = await agent.processMessage(options.message);
        spinner.stop();
        
        console.log(chalk.cyan('Assistant:'), response.content);
        
        if (response.usage) {
          console.log(
            chalk.gray(`Tokens: ${response.usage.totalTokens} | Cost: ~$${(response.usage.totalTokens * 0.00025 / 1000).toFixed(4)}`)
          );
        }
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      }
    } else {
      // Interactive mode
      console.log(chalk.cyan('🧠 Synapse AI'));
      console.log(chalk.gray('Type "exit" or "quit" to end the session\n'));

      const conversation = agent.createConversation();

      while (true) {
        const { message } = await inquirer.prompt([{
          type: 'input',
          name: 'message',
          message: chalk.blue('You:'),
        }]);

        if (['exit', 'quit', 'bye'].includes(message.toLowerCase())) {
          console.log(chalk.cyan('Goodbye! 👋'));
          break;
        }

        const spinner = ora('Thinking...').start();

        try {
          const response = await agent.processMessage(message, conversation.id);
          spinner.stop();
          
          console.log(chalk.cyan('Assistant:'), response.content);
          
          if (response.toolResults && response.toolResults.length > 0) {
            console.log(chalk.gray('Tools used:'), response.toolResults.map(t => t.toolCallId).join(', '));
          }
        } catch (error) {
          spinner.stop();
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        }
      }
    }
  });

// Config command
program
  .command('config')
  .description('Configure Synapse AI settings')
  .option('-k, --api-key <key>', 'Set API key')
  .option('-p, --provider <provider>', 'Set model provider (anthropic|openai|local)')
  .option('-m, --model <model>', 'Set model name')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    if (options.show) {
      const config = await loadConfig();
      console.log(chalk.cyan('Current Configuration:'));
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    const config = await loadConfig();

    if (options.apiKey) {
      config.model.apiKey = options.apiKey;
      console.log(chalk.green('✓ API key updated'));
    }

    if (options.provider) {
      config.model.provider = options.provider as any;
      console.log(chalk.green(`✓ Provider set to ${options.provider}`));
    }

    if (options.model) {
      config.model.model = options.model;
      console.log(chalk.green(`✓ Model set to ${options.model}`));
    }

    await saveConfig(config);
    console.log(chalk.green('Configuration saved!'));
  });

// Serve command
program
  .command('serve')
  .description('Start the gateway server')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('-h, --host <host>', 'Server host', 'localhost')
  .action(async (options) => {
    const config = await loadConfig();
    const agent = new Agent(config);
    await agent.initialize();

    const gatewayConfig = {
      port: parseInt(options.port),
      host: options.host,
      auth: {
        type: 'none' as const,
      },
      rateLimit: {
        enabled: true,
        maxRequests: 100,
        windowMs: 60000,
      },
    };

    const server = new GatewayServer(agent, gatewayConfig);
    await server.start();

    console.log(chalk.cyan(`\n🚀 Gateway server running!`));
    console.log(chalk.gray(`API: http://${options.host}:${options.port}`));
    console.log(chalk.gray(`Health: http://${options.host}:${options.port}/health`));
    console.log(chalk.gray('\nPress Ctrl+C to stop'));

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      await server.stop();
      process.exit(0);
    });
  });

// Stats command
program
  .command('stats')
  .description('Show usage statistics')
  .action(async () => {
    const config = await loadConfig();
    const agent = new Agent(config);
    await agent.initialize();

    const usageStats = agent.getUsageStats();
    const memoryStats = agent.getMemoryStats();

    console.log(chalk.cyan('📊 Usage Statistics\n'));
    
    console.log(chalk.yellow('Token Usage:'));
    console.log(`  Total Requests: ${usageStats.totalRequests}`);
    console.log(`  Total Tokens: ${usageStats.totalTokens.toLocaleString()}`);
    console.log(`  Avg Tokens/Request: ${usageStats.averageTokensPerRequest}`);
    console.log(`  Estimated Cost: $${usageStats.totalCost.toFixed(4)}`);
    
    console.log(chalk.yellow('\nMemory:'));
    console.log(`  Total Entries: ${memoryStats.total}`);
    console.log(`  Avg Importance: ${memoryStats.averageImportance}`);
    console.log(`  Categories: ${Object.keys(memoryStats.byCategory).join(', ')}`);
  });

// Memory command
program
  .command('memory')
  .description('Manage agent memory')
  .option('-s, --search <query>', 'Search memories')
  .option('-a, --add <content>', 'Add a memory')
  .option('-c, --category <category>', 'Memory category', 'general')
  .option('--clear', 'Clear all memories')
  .action(async (options) => {
    const config = await loadConfig();
    const agent = new Agent(config);
    await agent.initialize();

    const memoryManager = (agent as any).memoryManager;

    if (options.search) {
      const results = memoryManager.searchMemories(options.search);
      console.log(chalk.cyan(`Found ${results.length} memories:\n`));
      
      for (const mem of results) {
        console.log(chalk.yellow(`[${mem.category}]`), mem.content.substring(0, 100));
        console.log(chalk.gray(`  Importance: ${mem.importance} | ${mem.createdAt.toISOString()}\n`));
      }
    } else if (options.add) {
      await memoryManager.saveMemory(options.add, options.category, 0.7);
      console.log(chalk.green('✓ Memory added'));
    } else if (options.clear) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('Are you sure you want to clear all memories?'),
        default: false,
      }]);

      if (confirm) {
        await memoryManager.clearAll();
        console.log(chalk.green('✓ All memories cleared'));
      }
    } else {
      const stats = memoryManager.getStats();
      console.log(chalk.cyan('Memory Statistics:'));
      console.log(JSON.stringify(stats, null, 2));
    }
  });

// Init command
program
  .command('init')
  .description('Initialize Synapse AI configuration')
  .action(async () => {
    console.log(chalk.cyan('🚀 Welcome to Synapse AI Setup\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Choose your AI provider:',
        choices: [
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'OpenAI (GPT)', value: 'openai' },
          { name: 'Local Model', value: 'local' },
        ],
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Enter your API key:',
        when: (answers) => answers.provider !== 'local',
        mask: '*',
      },
      {
        type: 'list',
        name: 'model',
        message: 'Choose a model:',
        choices: (answers) => {
          if (answers.provider === 'anthropic') {
            return [
              { name: 'Claude 3 Haiku (Fastest, cheapest)', value: 'claude-3-haiku-20240307' },
              { name: 'Claude 3 Sonnet (Balanced)', value: 'claude-3-sonnet-20240229' },
              { name: 'Claude 3 Opus (Most capable)', value: 'claude-3-opus-20240229' },
            ];
          } else if (answers.provider === 'openai') {
            return [
              { name: 'GPT-3.5 Turbo (Fastest, cheapest)', value: 'gpt-3.5-turbo' },
              { name: 'GPT-4 Turbo (Most capable)', value: 'gpt-4-turbo-preview' },
            ];
          }
          return [{ name: 'Local Model', value: 'local' }];
        },
      },
      {
        type: 'confirm',
        name: 'enableMemory',
        message: 'Enable persistent memory?',
        default: true,
      },
    ]);

    const config: AgentConfig = {
      ...DEFAULT_CONFIG,
      model: {
        ...DEFAULT_CONFIG.model,
        provider: answers.provider,
        model: answers.model,
        apiKey: answers.apiKey,
      },
      memory: {
        ...DEFAULT_CONFIG.memory,
        enabled: answers.enableMemory,
      },
    };

    await saveConfig(config);
    console.log(chalk.green('\n✓ Configuration saved!'));
    console.log(chalk.gray(`Config location: ${CONFIG_PATH}`));
    console.log(chalk.cyan('\nYou can now start chatting with: synapse chat'));
  });

// Run the program
program.parse();
