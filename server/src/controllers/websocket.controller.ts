import { WebSocketServer, WebSocket } from 'ws';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import prisma from '../client';

// Notification types from Prisma schema
enum NotificationType {
  LOGIN_ALERT,
  PASSWORD_CHANGE,
  EMAIL_VERIFICATION,
  TWO_FACTOR_SETUP,
  ACCOUNT_LOCKED,
  SECURITY_ALERT,
  SYSTEM_UPDATE,
  WELCOME,
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  token?: string;
}

class WebSocketController {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map(); // userId -> Set of WebSocket connections
  private clientToUserId: Map<AuthenticatedWebSocket, string> = new Map(); // WebSocket -> userId

  constructor() {
    this.wss = new WebSocketServer({
      port: parseInt(process.env.WS_PORT || '8080'),
      path: '/ws',
    });

    this.setupEventHandlers();
    console.log(`WebSocket server started on port ${process.env.WS_PORT || '8080'}`);
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('New WebSocket connection attempt');

      // Set up ping/pong for connection health
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle authentication
      ws.on('message', async (message: string) => {
        try {
          const parsedMessage: WebSocketMessage = JSON.parse(message);
          await this.handleMessage(ws, parsedMessage);
        } catch (error) {
          console.error('Invalid message format:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle connection close
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      // Handle connection errors
      ws.on('error', error => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });

      // Set up ping interval
      const pingInterval = setInterval(() => {
        if (ws.isAlive === false) {
          clearInterval(pingInterval);
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      }, 30000); // 30 seconds

      // Auto-disconnect after 1 minute if not authenticated
      setTimeout(() => {
        if (!ws.isAuthenticated) {
          ws.close(1008, 'Authentication timeout');
        }
      }, 60000);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(ws, message.token);
        break;

      case 'mark_notification_read':
        await this.handleMarkAsRead(ws, message.data);
        break;

      case 'mark_all_notifications_read':
        await this.handleMarkAllAsRead(ws);
        break;

      case 'subscribe_notifications':
        await this.handleSubscribe(ws, message.data);
        break;

      case 'unsubscribe_notifications':
        await this.handleUnsubscribe(ws, message.data);
        break;

      case 'ping':
        this.sendPong(ws);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle authentication
   */
  private async handleAuthentication(ws: AuthenticatedWebSocket, token?: string): Promise<void> {
    try {
      if (!token) {
        this.sendError(ws, 'Authentication token required');
        return;
      }

      const decoded = jwt.verify(token, config.jwt.secret) as any;
      ws.userId = decoded.userId;
      ws.isAuthenticated = true;

      // Add to client tracking
      if (!this.clients.has(decoded.userId)) {
        this.clients.set(decoded.userId, new Set());
      }
      this.clients.get(decoded.userId)!.add(ws);
      this.clientToUserId.set(ws, decoded.userId);

      console.log(`User ${decoded.userId} authenticated via WebSocket`);

      // Send success response
      this.sendMessage(ws, {
        type: 'authenticated',
        data: {
          userId: decoded.userId,
          message: 'Successfully authenticated',
        },
      });
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendError(ws, 'Invalid authentication token');
    }
  }

  /**
   * Handle mark notification as read
   */
  private async handleMarkAsRead(
    ws: AuthenticatedWebSocket,
    data: { notificationId: string }
  ): Promise<void> {
    if (!ws.isAuthenticated || !ws.userId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    try {
      const { default: notificationService } = await import('../services/notification.service');
      await notificationService.markAsRead(ws.userId, data.notificationId);

      // Broadcast to user's other connections
      this.broadcastToUser(
        ws.userId,
        {
          type: 'notification_marked_read',
          data: {
            notificationId: data.notificationId,
            userId: ws.userId,
          },
        },
        ws
      );

      this.sendMessage(ws, {
        type: 'notification_marked_read_success',
        data: { notificationId: data.notificationId },
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      this.sendError(ws, 'Failed to mark notification as read');
    }
  }

  /**
   * Handle mark all notifications as read
   */
  private async handleMarkAllAsRead(ws: AuthenticatedWebSocket): Promise<void> {
    if (!ws.isAuthenticated || !ws.userId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    try {
      const { default: notificationService } = await import('../services/notification.service');
      const count = await notificationService.markAllAsRead(ws.userId);

      // Broadcast to user's other connections
      this.broadcastToUser(
        ws.userId,
        {
          type: 'all_notifications_marked_read',
          data: {
            count,
            userId: ws.userId,
          },
        },
        ws
      );

      this.sendMessage(ws, {
        type: 'all_notifications_marked_read_success',
        data: { count },
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      this.sendError(ws, 'Failed to mark all notifications as read');
    }
  }

  /**
   * Handle notification subscription
   */
  private async handleSubscribe(
    ws: AuthenticatedWebSocket,
    data: { types: NotificationType[] }
  ): Promise<void> {
    if (!ws.isAuthenticated) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    // Store subscription data on the WebSocket
    (ws as any).subscriptions = data.types || [];

    this.sendMessage(ws, {
      type: 'subscribed',
      data: { types: data.types },
    });
  }

  /**
   * Handle notification unsubscription
   */
  private async handleUnsubscribe(
    ws: AuthenticatedWebSocket,
    data: { types: NotificationType[] }
  ): Promise<void> {
    if (!ws.isAuthenticated) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    const subscriptions = (ws as any).subscriptions || [];
    data.types.forEach((type: NotificationType) => {
      const index = subscriptions.indexOf(type);
      if (index > -1) {
        subscriptions.splice(index, 1);
      }
    });

    this.sendMessage(ws, {
      type: 'unsubscribed',
      data: { types: data.types },
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      console.log(`User ${ws.userId} disconnected from WebSocket`);

      // Remove from client tracking
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
      this.clientToUserId.delete(ws);
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: AuthenticatedWebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to WebSocket client
   */
  private sendError(ws: AuthenticatedWebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { error },
    });
  }

  /**
   * Send pong response
   */
  private sendPong(ws: AuthenticatedWebSocket): void {
    this.sendMessage(ws, { type: 'pong' });
  }

  /**
   * Broadcast message to all connections of a user
   */
  private broadcastToUser(userId: string, message: any, excludeWs?: AuthenticatedWebSocket): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
          this.sendMessage(client, message);
        }
      });
    }
  }

  /**
   * Send push notification to user
   */
  async sendPushNotification(
    userId: string,
    notification: {
      type: NotificationType;
      title: string;
      message: string;
      metadata?: any;
    }
  ): Promise<void> {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const message = {
      type: 'push_notification',
      data: {
        id: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...notification,
        timestamp: new Date(),
        isRead: false,
      },
    };

    userClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        // Check if user is subscribed to this notification type
        const subscriptions = (client as any).subscriptions || [];
        if (subscriptions.length === 0 || subscriptions.includes(notification.type)) {
          this.sendMessage(client, message);
        }
      }
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.clients.size;
  }

  /**
   * Get user's active connections
   */
  getUserConnections(userId: string): number {
    return this.clients.get(userId)?.size || 0;
  }

  /**
   * Broadcast to all connected users
   */
  async broadcastNotification(notification: {
    type: NotificationType;
    title: string;
    message: string;
    metadata?: any;
  }): Promise<void> {
    const message = {
      type: 'broadcast_notification',
      data: {
        ...notification,
        timestamp: new Date(),
      },
    };

    this.clients.forEach(userClients => {
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          this.sendMessage(client, message);
        }
      });
    });
  }

  /**
   * Get WebSocket server instance
   */
  getServer(): WebSocketServer {
    return this.wss;
  }
}

// Singleton instance
let webSocketController: WebSocketController | null = null;

/**
 * Initialize WebSocket controller
 */
export const initializeWebSocket = (): WebSocketController => {
  if (!webSocketController) {
    webSocketController = new WebSocketController();
  }
  return webSocketController;
};

/**
 * Get WebSocket controller instance
 */
export const getWebSocketController = (): WebSocketController => {
  if (!webSocketController) {
    throw new Error('WebSocket controller not initialized. Call initializeWebSocket first.');
  }
  return webSocketController;
};

export default WebSocketController;
