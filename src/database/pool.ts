/**
 * Database Connection Pool
 * 
 * Manages a pool of database connections for improved performance
 */

import { PrismaClient } from '@prisma/client';

export interface ConnectionPoolConfig {
  size: number;
  databaseUrl: string;
  timeout?: number;
  idleTimeout?: number;
}

export interface PoolStatus {
  total: number;
  active: number;
  idle: number;
  waiting: number;
}

interface PoolConnection {
  client: PrismaClient;
  inUse: boolean;
  lastUsed: Date;
  createdAt: Date;
}

export class ConnectionPool {
  private config: ConnectionPoolConfig;
  private connections: PoolConnection[] = [];
  private waitQueue: Array<{
    resolve: (client: PrismaClient) => void;
    reject: (error: Error) => void;
    timestamp: Date;
  }> = [];
  private initialized: boolean = false;

  constructor(config: ConnectionPoolConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000, // 30 seconds default
      idleTimeout: config.idleTimeout || 60000, // 60 seconds default
    };
  }

  /**
   * Initialize the connection pool
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create initial connections
      for (let i = 0; i < this.config.size; i++) {
        await this.createConnection();
      }

      // Start idle connection cleanup
      this.startIdleConnectionCleanup();

      this.initialized = true;
      console.log(`Connection pool initialized with ${this.config.size} connections`);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  public async acquire(): Promise<PrismaClient> {
    // Find an idle connection
    const connection = this.connections.find(conn => !conn.inUse);

    if (connection) {
      connection.inUse = true;
      connection.lastUsed = new Date();
      return connection.client;
    }

    // No idle connections available, add to wait queue
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue
        const index = this.waitQueue.findIndex(
          item => item.resolve === resolve
        );
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Connection pool timeout'));
      }, this.config.timeout);

      this.waitQueue.push({
        resolve: (client) => {
          clearTimeout(timeoutId);
          resolve(client);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: new Date(),
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  public async release(client: PrismaClient): Promise<void> {
    const connection = this.connections.find(conn => conn.client === client);

    if (!connection) {
      console.warn('Attempted to release unknown connection');
      return;
    }

    connection.inUse = false;
    connection.lastUsed = new Date();

    // Process wait queue
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      if (waiter) {
        connection.inUse = true;
        waiter.resolve(client);
      }
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  public async execute<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    const client = await this.acquire();
    try {
      return await fn(client);
    } finally {
      await this.release(client);
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<void> {
    try {
      const client = new PrismaClient({
        datasources: {
          db: {
            url: this.config.databaseUrl,
          },
        },
      });

      await client.$connect();

      this.connections.push({
        client,
        inUse: false,
        lastUsed: new Date(),
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to create connection:', error);
      throw error;
    }
  }

  /**
   * Remove a connection from the pool
   */
  private async removeConnection(connection: PoolConnection): Promise<void> {
    try {
      await connection.client.$disconnect();
      
      const index = this.connections.indexOf(connection);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
    } catch (error) {
      console.error('Error removing connection:', error);
    }
  }

  /**
   * Start idle connection cleanup
   */
  private startIdleConnectionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const idleTimeout = this.config.idleTimeout || 60000;

      for (const connection of this.connections) {
        if (!connection.inUse) {
          const idleTime = now.getTime() - connection.lastUsed.getTime();
          
          if (idleTime > idleTimeout) {
            // Don't remove if we're at minimum size
            if (this.connections.length > Math.floor(this.config.size / 2)) {
              this.removeConnection(connection);
            }
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get pool status
   */
  public getStatus(): PoolStatus {
    const active = this.connections.filter(conn => conn.inUse).length;
    const idle = this.connections.filter(conn => !conn.inUse).length;

    return {
      total: this.connections.length,
      active,
      idle,
      waiting: this.waitQueue.length,
    };
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      waiter.reject(new Error('Connection pool is closing'));
    }
    this.waitQueue = [];

    // Close all connections
    const closePromises = this.connections.map(conn =>
      conn.client.$disconnect()
    );

    await Promise.all(closePromises);
    this.connections = [];
    this.initialized = false;

    console.log('Connection pool closed');
  }

  /**
   * Check if pool is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get pool configuration
   */
  public getConfig(): ConnectionPoolConfig {
    return { ...this.config };
  }

  /**
   * Resize the pool
   */
  public async resize(newSize: number): Promise<void> {
    const currentSize = this.connections.length;

    if (newSize > currentSize) {
      // Add connections
      const toAdd = newSize - currentSize;
      for (let i = 0; i < toAdd; i++) {
        await this.createConnection();
      }
    } else if (newSize < currentSize) {
      // Remove idle connections
      const toRemove = currentSize - newSize;
      let removed = 0;

      for (const connection of this.connections) {
        if (!connection.inUse && removed < toRemove) {
          await this.removeConnection(connection);
          removed++;
        }
      }
    }

    this.config.size = newSize;
    console.log(`Connection pool resized to ${newSize} connections`);
  }

  /**
   * Health check for the pool
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: PoolStatus & { errors?: string[] };
  }> {
    const status = this.getStatus();
    const errors: string[] = [];

    if (!this.initialized) {
      errors.push('Pool not initialized');
    }

    if (status.total === 0) {
      errors.push('No connections in pool');
    }

    if (status.waiting > status.total) {
      errors.push('High wait queue');
    }

    // Test a connection
    try {
      await this.execute(async (client) => {
        await client.$queryRaw`SELECT 1`;
      });
    } catch (error) {
      errors.push('Connection test failed');
    }

    let healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (errors.length === 0) {
      healthStatus = 'healthy';
    } else if (errors.length <= 2) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'unhealthy';
    }

    return {
      status: healthStatus,
      details: {
        ...status,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }
}
