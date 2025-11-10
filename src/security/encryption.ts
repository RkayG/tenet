/**
 * Encryption Service
 *
 * Provides data encryption and decryption for sensitive information
 * using AES-256-GCM encryption with proper key management.
 */

import { createCipherGCM, createDecipherGCM, randomBytes, scryptSync } from 'crypto';
import { EncryptionAlgorithm } from '../core/types';

export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
  key?: string;
  keyLength?: number;
  ivLength?: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  algorithm: EncryptionAlgorithm;
  timestamp: Date;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private algorithm: EncryptionAlgorithm;
  private key: Buffer;
  private keyLength: number;
  private ivLength: number;

  private constructor(options: EncryptionOptions = {}) {
    this.algorithm = options.algorithm || 'AES-256-GCM';
    this.keyLength = options.keyLength || 32; // 256 bits
    this.ivLength = options.ivLength || 16; // 128 bits

    // Use provided key or derive from environment
    if (options.key) {
      this.key = this.deriveKey(options.key);
    } else if (process.env.ENCRYPTION_KEY) {
      this.key = this.deriveKey(process.env.ENCRYPTION_KEY);
    } else {
      throw new Error('Encryption key not provided. Set ENCRYPTION_KEY environment variable or provide key in options.');
    }
  }

  public static getInstance(options?: EncryptionOptions): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService(options);
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  public async encrypt(data: any, options: Partial<EncryptionOptions> = {}): Promise<string> {
    try {
      const jsonData = JSON.stringify(data);
      const iv = randomBytes(this.ivLength);

      const cipher = createCipherGCM(
        options.algorithm || this.algorithm,
        options.key ? this.deriveKey(options.key) : this.key,
        iv
      );

      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: authTag.toString('hex'),
        algorithm: this.algorithm,
        timestamp: new Date(),
      };

      return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data
   */
  public async decrypt(encryptedString: string, options: Partial<EncryptionOptions> = {}): Promise<any> {
    try {
      const encryptedData: EncryptedData = JSON.parse(
        Buffer.from(encryptedString, 'base64').toString('utf8')
      );

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      const decipher = createDecipherGCM(
        options.algorithm || encryptedData.algorithm,
        options.key ? this.deriveKey(options.key) : this.key,
        iv
      );

      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt specific fields in an object
   */
  public async encryptFields(
    data: Record<string, any>,
    fields: string[],
    options: Partial<EncryptionOptions> = {}
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = await this.encrypt(result[field], options);
      }
    }

    return result;
  }

  /**
   * Decrypt specific fields in an object
   */
  public async decryptFields(
    data: Record<string, any>,
    fields: string[],
    options: Partial<EncryptionOptions> = {}
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        try {
          result[field] = await this.decrypt(result[field], options);
        } catch (error) {
          // If decryption fails, keep the original value
          console.warn(`Failed to decrypt field ${field}:`, error.message);
        }
      }
    }

    return result;
  }

  /**
   * Process response data - encrypt sensitive fields
   */
  public async processResponse(data: any): Promise<any> {
    // This would be configured based on your needs
    // For now, we'll encrypt fields that contain sensitive keywords
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'credit_card'];

    if (typeof data === 'object' && data !== null) {
      return this.encryptFields(data, sensitiveFields);
    }

    return data;
  }

  /**
   * Process request data - decrypt encrypted fields
   */
  public async processRequest(data: any): Promise<any> {
    const encryptedFields = ['encrypted_data', 'secure_payload'];

    if (typeof data === 'object' && data !== null) {
      return this.decryptFields(data, encryptedFields);
    }

    return data;
  }

  /**
   * Generate a new encryption key
   */
  public static generateKey(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Derive a key from a password using scrypt
   */
  private deriveKey(password: string): Buffer {
    const salt = process.env.ENCRYPTION_SALT || 'default-salt-change-in-production';
    return scryptSync(password, salt, this.keyLength);
  }

  /**
   * Hash data without encryption (for one-way hashing like passwords)
   */
  public async hash(data: string, saltRounds: number = 12): Promise<string> {
    // This is a simple implementation - in production, use bcrypt
    const crypto = await import('crypto');
    const salt = randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(data, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify hashed data
   */
  public async verifyHash(data: string, hashedData: string): Promise<boolean> {
    const crypto = await import('crypto');
    const [salt, hash] = hashedData.split(':');
    const dataHash = crypto.scryptSync(data, salt, 64).toString('hex');
    return hash === dataHash;
  }

  /**
   * Create a hash-based message authentication code (HMAC)
   */
  public createHMAC(data: string, key?: string): string {
    const crypto = await import('crypto');
    const hmacKey = key ? this.deriveKey(key) : this.key;
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC
   */
  public verifyHMAC(data: string, hmac: string, key?: string): boolean {
    const calculatedHMAC = this.createHMAC(data, key);
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHMAC, 'hex'),
      Buffer.from(hmac, 'hex')
    );
  }

  /**
   * Generate a secure random token
   */
  public generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Encrypt a file buffer
   */
  public async encryptFile(buffer: Buffer, options: Partial<EncryptionOptions> = {}): Promise<Buffer> {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipherGCM(
      options.algorithm || this.algorithm,
      options.key ? this.deriveKey(options.key) : this.key,
      iv
    );

    const encrypted = Buffer.concat([
      iv,
      cipher.update(buffer),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return encrypted;
  }

  /**
   * Decrypt a file buffer
   */
  public async decryptFile(encryptedBuffer: Buffer, options: Partial<EncryptionOptions> = {}): Promise<Buffer> {
    const iv = encryptedBuffer.subarray(0, this.ivLength);
    const tag = encryptedBuffer.subarray(-16); // GCM tag is 16 bytes
    const data = encryptedBuffer.subarray(this.ivLength, -16);

    const decipher = createDecipherGCM(
      options.algorithm || this.algorithm,
      options.key ? this.deriveKey(options.key) : this.key,
      iv
    );

    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
  }

  /**
   * Get encryption metadata
   */
  public getMetadata(): {
    algorithm: EncryptionAlgorithm;
    keyLength: number;
    ivLength: number;
  } {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
    };
  }
}
