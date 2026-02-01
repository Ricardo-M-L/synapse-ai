/**
 * Synapse AI Gateway Server
 * 
 * Features:
 * - REST API for agent interactions
 * - WebSocket for real-time communication
 * - Authentication and rate limiting
 * - CORS and security headers
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { Agent } from '../core/agent.js';
import { GatewayConfig, Message } from '../types/index.js';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export class GatewayServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private agent: Agent;
  private config: GatewayConfig;
  private clients: Map<string, WebSocket> = new Map();

  constructor(agent: Agent, config: GatewayConfig) {
    this.agent = agent;
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
  }

  /**
   * Initialize and start the server
   */
  async start(): Promise<void> {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`🚀 Gateway server running on http://${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    if (this.config.rateLimit.enabled) {
      this.setupRateLimiting();
    }

    // Authentication
    if (this.config.auth.type !== 'none') {
      this.setupAuthentication();
    }
  }

  /**
   * Setup rate limiting
   */
  private setupRateLimiting(): void {
    const requests = new Map<string, number[]>();

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - this.config.rateLimit.windowMs;

      const clientRequests = requests.get(clientId) || [];
      const recentRequests = clientRequests.filter(time => time > windowStart);

      if (recentRequests.length >= this.config.rateLimit.maxRequests) {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(this.config.rateLimit.windowMs / 1000),
        });
        return;
      }

      recentRequests.push(now);
      requests.set(clientId, recentRequests);
      next();
    });
  }

  /**
   * Setup authentication
   */
  private setupAuthentication(): void {
    this.app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (req.path === '/health') {
        return next();
      }

      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({ error: 'Authorization required' });
        return;
      }

      if (this.config.auth.type === 'token') {
        const token = authHeader.replace('Bearer ', '');
        if (token !== this.config.auth.secret) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }
      } else if (this.config.auth.type === 'password') {
        const credentials = Buffer.from(authHeader.replace('Basic ', ''), 'base64')
          .toString()
          .split(':');
        
        if (credentials[1] !== this.config.auth.secret) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
      }

      req.user = { id: 'authenticated' };
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // Chat endpoint
    this.app.post('/chat', async (req: Request, res: Response) => {
      try {
        const { message, conversationId, stream = false } = req.body;

        if (!message) {
          res.status(400).json({ error: 'Message is required' });
          return;
        }

        if (stream) {
          // Set up streaming response
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          for await (const chunk of this.agent.streamMessage(message, conversationId)) {
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          }

          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          const response = await this.agent.processMessage(message, conversationId);
          res.json({
            content: response.content,
            toolResults: response.toolResults,
            usage: response.usage,
          });
        }
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    });

    // Conversations endpoints
    this.app.get('/conversations', (_req: Request, res: Response) => {
      try {
        const conversations = this.agent.getAllConversations();
        res.json(conversations.map(c => ({
          id: c.id,
          messageCount: c.messages.length,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })));
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    });

    this.app.get('/conversations/:id', (req: Request, res: Response) => {
      try {
        const conversation = this.agent.getConversation(req.params.id);
        res.json(conversation);
      } catch (error) {
        res.status(404).json({
          error: error instanceof Error ? error.message : 'Conversation not found',
        });
      }
    });

    this.app.delete('/conversations/:id', (req: Request, res: Response) => {
      try {
        const deleted = this.agent.deleteConversation(req.params.id);
        res.json({ deleted });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    });

    // Stats endpoints
    this.app.get('/stats/usage', (_req: Request, res: Response) => {
      try {
        const stats = this.agent.getUsageStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    });

    this.app.get('/stats/memory', (_req: Request, res: Response) => {
      try {
        const stats = this.agent.getMemoryStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    });

    // Skills endpoint
    this.app.get('/skills', (_req: Request, res: Response) => {
      try {
        // Access skill registry through agent
        const skills = (this.agent as any).skillRegistry?.getAllSkills() || [];
        res.json(skills.map((s: any) => ({
          name: s.name,
          description: s.description,
          parameters: s.parameters,
        })));
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    });
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = `${req.socket.remoteAddress}-${Date.now()}`;
      this.clients.set(clientId, ws);

      console.log(`Client connected: ${clientId}`);

      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data);
          
          switch (message.type) {
            case 'chat':
              await this.handleWebSocketChat(ws, message);
              break;
            
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
            
            default:
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Unknown message type',
              }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Invalid message',
          }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        message: 'Connected to Synapse AI Gateway',
      }));
    });
  }

  /**
   * Handle WebSocket chat message
   */
  private async handleWebSocketChat(ws: WebSocket, message: any): Promise<void> {
    const { content, conversationId, stream = false } = message;

    if (!content) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Content is required',
      }));
      return;
    }

    try {
      if (stream) {
        for await (const chunk of this.agent.streamMessage(content, conversationId)) {
          ws.send(JSON.stringify({
            type: 'stream',
            content: chunk,
          }));
        }

        ws.send(JSON.stringify({
          type: 'stream_end',
        }));
      } else {
        const response = await this.agent.processMessage(content, conversationId);
        
        ws.send(JSON.stringify({
          type: 'response',
          content: response.content,
          toolResults: response.toolResults,
          usage: response.usage,
        }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Processing failed',
      }));
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      for (const [clientId, ws] of this.clients) {
        ws.close();
        this.clients.delete(clientId);
      }

      // Close WebSocket server
      this.wss.close();

      // Close HTTP server
      this.server.close(() => {
        console.log('Gateway server stopped');
        resolve();
      });
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}

export default GatewayServer;
