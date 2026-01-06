/**
 * Logger Utility
 * 
 * Provides structured logging with different levels and formats
 */

import * as winston from 'winston';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'text';
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxSize?: string;
  maxFiles?: number;
}

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private config: LoggerConfig;

  private constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || 'info',
      format: config.format || 'json',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile || false,
      filePath: config.filePath || 'logs/app.log',
      maxSize: config.maxSize || '10m',
      maxFiles: config.maxFiles || 5,
    };

    this.logger = this.createLogger();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Create Winston logger instance
   */
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            this.config.format === 'json'
              ? winston.format.json()
              : winston.format.simple()
          ),
        })
      );
    }

    // File transport
    if (this.config.enableFile) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath!,
          maxsize: this.parseSize(this.config.maxSize!),
          maxFiles: this.config.maxFiles!,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    return winston.createLogger({
      level: this.config.level!,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
    });
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = size.match(/^(\d+)([bkmg]?)$/i);
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }

    const value = parseInt(match[1]!);
    const unit = (match[2] || 'b').toLowerCase();

    return value * (units[unit] || 1);
  }

  /**
   * Log debug message
   */
  public debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log info message
   */
  public info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning message
   */
  public warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error message
   */
  public error(message: string, error?: Error | any, meta?: Record<string, any>): void {
    const errorMeta = error instanceof Error
      ? {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        ...meta,
      }
      : { error, ...meta };

    this.logger.error(message, errorMeta);
  }

  /**
   * Log with custom level
   */
  public log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    this.logger.log(level, message, meta);
  }

  /**
   * Create child logger with default metadata
   */
  public child(defaultMeta: Record<string, any>): winston.Logger {
    return this.logger.child(defaultMeta);
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel): void {
    this.logger.level = level;
    this.config.level = level;
  }

  /**
   * Get current log level
   */
  public getLevel(): LogLevel {
    return this.config.level!;
  }

  /**
   * Log HTTP request
   */
  public logRequest(req: any): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    });
  }

  /**
   * Log HTTP response
   */
  public logResponse(req: any, res: any, duration: number): void {
    this.info('HTTP Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
    });
  }

  /**
   * Log database query
   */
  public logQuery(query: string, duration: number, params?: any): void {
    this.debug('Database Query', {
      query,
      duration: `${duration}ms`,
      params,
    });
  }

  /**
   * Log authentication event
   */
  public logAuth(event: 'success' | 'failure', userId?: string, reason?: string): void {
    if (event === 'success') {
      this.info('Authentication Success', { userId });
    } else {
      this.warn('Authentication Failure', { userId, reason });
    }
  }

  /**
   * Log security event
   */
  public logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.log(level, `Security Event: ${event}`, {
      severity,
      ...details,
    });
  }

  /**
   * Get logger configuration
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }
}
