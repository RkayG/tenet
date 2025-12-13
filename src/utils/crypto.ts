/**
 * Cryptography Utilities
 * 
 * Provides cryptographic functions for hashing, encryption, and token generation
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export class CryptoUtils {
  /**
   * Generate random string
   */
  public static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate random token (URL-safe)
   */
  public static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Generate UUID v4
   */
  public static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Hash password using bcrypt
   */
  public static async hashPassword(password: string, rounds: number = 10): Promise<string> {
    return await bcrypt.hash(password, rounds);
  }

  /**
   * Compare password with hash
   */
  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate SHA-256 hash
   */
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate SHA-512 hash
   */
  public static sha512(data: string): string {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  /**
   * Generate MD5 hash (not recommended for security, use for checksums only)
   */
  public static md5(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Generate HMAC signature
   */
  public static hmac(data: string, key: string, algorithm: string = 'sha256'): string {
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  public static encrypt(text: string, key: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    // Generate IV (initialization vector)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      iv
    );

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  public static decrypt(encrypted: string, key: string, iv: string, authTag: string): string {
    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key, 'hex'),
        Buffer.from(iv, 'hex')
      );

      // Set auth tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt data using AES-256-CBC (simpler, no auth tag)
   */
  public static encryptCBC(text: string, key: string): {
    encrypted: string;
    iv: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'hex'),
      iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
    };
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  public static decryptCBC(encrypted: string, key: string, iv: string): string {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(key, 'hex'),
        Buffer.from(iv, 'hex')
      );

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate encryption key (256-bit)
   */
  public static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Derive key from password using PBKDF2
   */
  public static deriveKey(password: string, salt: string, iterations: number = 100000): string {
    return crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      32,
      'sha256'
    ).toString('hex');
  }

  /**
   * Generate salt for password derivation
   */
  public static generateSalt(length: number = 16): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Constant-time string comparison (prevents timing attacks)
   */
  public static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Generate API key
   */
  public static generateApiKey(prefix: string = 'sk'): string {
    const randomPart = this.generateRandomString(32);
    return `${prefix}_${randomPart}`;
  }

  /**
   * Encode to Base64
   */
  public static encodeBase64(data: string): string {
    return Buffer.from(data, 'utf8').toString('base64');
  }

  /**
   * Decode from Base64
   */
  public static decodeBase64(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  /**
   * Encode to Base64 URL-safe
   */
  public static encodeBase64Url(data: string): string {
    return Buffer.from(data, 'utf8').toString('base64url');
  }

  /**
   * Decode from Base64 URL-safe
   */
  public static decodeBase64Url(encoded: string): string {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  }

  /**
   * Generate OTP (One-Time Password)
   */
  public static generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      otp += digits[randomIndex];
    }

    return otp;
  }

  /**
   * Generate secure random number in range
   */
  public static randomInt(min: number, max: number): number {
    return crypto.randomInt(min, max + 1);
  }

  /**
   * Mask sensitive data (e.g., credit card, email)
   */
  public static mask(data: string, visibleChars: number = 4, maskChar: string = '*'): string {
    if (data.length <= visibleChars) {
      return data;
    }

    const masked = maskChar.repeat(data.length - visibleChars);
    return masked + data.slice(-visibleChars);
  }

  /**
   * Generate checksum for data integrity
   */
  public static checksum(data: string): string {
    return this.sha256(data);
  }

  /**
   * Sign data (HMAC signature)
   */
  public static sign(data: string, secret: string): string {
    return this.hmac(data, secret);
  }

  /**
   * Verify signature
   */
  public static verify(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.sign(data, secret);
    return this.secureCompare(signature, expectedSignature);
  }

  /**
   * Create fingerprint from multiple values
   */
  public static fingerprint(...values: string[]): string {
    return this.sha256(values.join('|'));
  }

  /**
   * Generate CSRF token
   */
  public static generateCSRFToken(): string {
    return this.generateToken(32);
  }

  /**
   * Generate nonce
   */
  public static generateNonce(): string {
    return this.generateToken(16);
  }

  /**
   * Hash file content (for file integrity)
   */
  public static hashFile(content: Buffer, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Generate deterministic ID from data
   */
  public static generateDeterministicId(data: string): string {
    return this.sha256(data).substring(0, 24);
  }
}
