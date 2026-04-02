// Client-side WebSocket utilities for push notifications

export interface PushNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  timestamp: Date;
  isRead: boolean;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  token?: string;
}

export enum WebSocketMessageType {
  AUTHENTICATE = 'authenticate',
  PING = 'ping',
  PONG = 'pong',
  MARK_NOTIFICATION_READ = 'mark_notification_read',
  MARK_ALL_NOTIFICATIONS_READ = 'mark_all_notifications_read',
  SUBSCRIBE_NOTIFICATIONS = 'subscribe_notifications',
  UNSUBSCRIBE_NOTIFICATIONS = 'unsubscribe_notifications',
}

export enum WebSocketEventType {
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  PUSH_NOTIFICATION = 'push_notification',
  NOTIFICATION_MARKED_READ = 'notification_marked_read',
  ALL_NOTIFICATIONS_MARKED_READ = 'all_notifications_marked_read',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  ERROR = 'error',
  DISCONNECT = 'disconnect',
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isConnecting = false;
  private isManualDisconnect = false;
  private subscriptions: string[] = [];
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(wsUrl: string, token?: string) {
    this.wsUrl = wsUrl;
    this.token = token;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.isManualDisconnect = false;

      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;

          // Authenticate if token is available
          if (this.token) {
            this.authenticate();
          }

          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = event => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;

          if (!this.isManualDisconnect) {
            this.scheduleReconnect();
          }

          this.emit(WebSocketEventType.DISCONNECT, { code: event.code, reason: event.reason });
        };

        this.ws.onerror = error => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          this.ws = null;

          if (!this.isManualDisconnect) {
            this.scheduleReconnect();
          }

          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  /**
   * Send authentication message
   */
  authenticate(): void {
    if (!this.token) {
      console.warn('No token available for authentication');
      return;
    }

    this.sendMessage({
      type: WebSocketMessageType.AUTHENTICATE,
      token: this.token,
    });
  }

  /**
   * Update authentication token
   */
  updateToken(token: string): void {
    this.token = token;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.authenticate();
    }
  }

  /**
   * Subscribe to notification types
   */
  subscribeToNotifications(types: string[]): void {
    this.subscriptions = [...new Set([...this.subscriptions, ...types])];
    this.sendMessage({
      type: WebSocketMessageType.SUBSCRIBE_NOTIFICATIONS,
      data: { types },
    });
  }

  /**
   * Unsubscribe from notification types
   */
  unsubscribeFromNotifications(types: string[]): void {
    this.subscriptions = this.subscriptions.filter(type => !types.includes(type));
    this.sendMessage({
      type: WebSocketMessageType.UNSUBSCRIBE_NOTIFICATIONS,
      data: { types },
    });
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string): void {
    this.sendMessage({
      type: WebSocketMessageType.MARK_NOTIFICATION_READ,
      data: { notificationId },
    });
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead(): void {
    this.sendMessage({
      type: WebSocketMessageType.MARK_ALL_NOTIFICATIONS_READ,
    });
  }

  /**
   * Send ping message
   */
  ping(): void {
    this.sendMessage({
      type: WebSocketMessageType.PING,
    });
  }

  /**
   * Send message to WebSocket server
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WebSocketEventType.CONNECTED:
        this.emit(WebSocketEventType.CONNECTED, message.data);
        break;

      case WebSocketEventType.AUTHENTICATED:
        this.emit(WebSocketEventType.AUTHENTICATED, message.data);
        break;

      case WebSocketEventType.PUSH_NOTIFICATION:
        this.emit(WebSocketEventType.PUSH_NOTIFICATION, message.data);
        break;

      case WebSocketEventType.NOTIFICATION_MARKED_READ:
        this.emit(WebSocketEventType.NOTIFICATION_MARKED_READ, message.data);
        break;

      case WebSocketEventType.ALL_NOTIFICATIONS_MARKED_READ:
        this.emit(WebSocketEventType.ALL_NOTIFICATIONS_MARKED_READ, message.data);
        break;

      case WebSocketEventType.SUBSCRIBED:
        this.emit(WebSocketEventType.SUBSCRIBED, message.data);
        break;

      case WebSocketEventType.UNSUBSCRIBED:
        this.emit(WebSocketEventType.UNSUBSCRIBED, message.data);
        break;

      case WebSocketEventType.ERROR:
        this.emit(WebSocketEventType.ERROR, message.error);
        break;

      case 'pong':
        // Handle pong response
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit(WebSocketEventType.ERROR, 'Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Add event listener
   */
  on(eventType: string, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: string, callback?: Function): void {
    if (!this.eventListeners.has(eventType)) return;

    const listeners = this.eventListeners.get(eventType)!;
    if (callback) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      listeners.length = 0;
    }

    if (listeners.length === 0) {
      this.eventListeners.delete(eventType);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(eventType: string, data?: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current subscriptions
   */
  get currentSubscriptions(): string[] {
    return [...this.subscriptions];
  }

  /**
   * Get reconnection status
   */
  get reconnecting(): boolean {
    return this.isConnecting || this.reconnectAttempts > 0;
  }
}

/**
 * Create WebSocket client instance
 */
export const createWebSocketClient = (
  wsUrl: string = `ws://localhost:${process.env.WS_PORT || '8080'}/ws`,
  token?: string
): WebSocketClient => {
  return new WebSocketClient(wsUrl, token);
};
