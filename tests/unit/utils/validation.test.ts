/**
 * Validation Utility Unit Tests
 * 
 * Tests for validation helper functions
 */

import { z } from 'zod';
import {
    validateEmail,
    validatePassword,
    validateUUID,
    validateURL,
    validatePhoneNumber,
    sanitizeFilename,
    validateIPAddress,
} from '../../../src/utils/validation';

describe('Validation Utilities', () => {
    describe('Email Validation', () => {
        it('should validate correct email addresses', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('user.name@domain.co.uk')).toBe(true);
            expect(validateEmail('user+tag@example.com')).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            expect(validateEmail('invalid')).toBe(false);
            expect(validateEmail('missing@domain')).toBe(false);
            expect(validateEmail('@example.com')).toBe(false);
            expect(validateEmail('user@')).toBe(false);
        });
    });

    describe('Password Validation', () => {
        it('should validate strong passwords', () => {
            expect(validatePassword('StrongP@ss123')).toBe(true);
            expect(validatePassword('C0mpl3x!Pass')).toBe(true);
        });

        it('should reject weak passwords', () => {
            expect(validatePassword('weak')).toBe(false);
            expect(validatePassword('nospecialchar123')).toBe(false);
            expect(validatePassword('NoNumbers!')).toBe(false);
            expect(validatePassword('nouppercase123!')).toBe(false);
        });

        it('should enforce minimum length', () => {
            expect(validatePassword('Short1!')).toBe(false);
            expect(validatePassword('LongEnough1!')).toBe(true);
        });
    });

    describe('UUID Validation', () => {
        it('should validate correct UUIDs', () => {
            expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
            expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        });

        it('should reject invalid UUIDs', () => {
            expect(validateUUID('invalid-uuid')).toBe(false);
            expect(validateUUID('123')).toBe(false);
            expect(validateUUID('')).toBe(false);
        });
    });

    describe('URL Validation', () => {
        it('should validate correct URLs', () => {
            expect(validateURL('https://example.com')).toBe(true);
            expect(validateURL('http://subdomain.example.com/path')).toBe(true);
            expect(validateURL('https://example.com:8080/path?query=value')).toBe(true);
        });

        it('should reject invalid URLs', () => {
            expect(validateURL('not-a-url')).toBe(false);
            expect(validateURL('ftp://example.com')).toBe(false);
            expect(validateURL('//example.com')).toBe(false);
        });
    });

    describe('Phone Number Validation', () => {
        it('should validate correct phone numbers', () => {
            expect(validatePhoneNumber('+1234567890')).toBe(true);
            expect(validatePhoneNumber('+44 20 1234 5678')).toBe(true);
        });

        it('should reject invalid phone numbers', () => {
            expect(validatePhoneNumber('123')).toBe(false);
            expect(validatePhoneNumber('invalid')).toBe(false);
        });
    });

    describe('Filename Sanitization', () => {
        it('should sanitize filenames', () => {
            expect(sanitizeFilename('file name.txt')).toBe('file_name.txt');
            expect(sanitizeFilename('file/with\\slashes.txt')).toBe('file_with_slashes.txt');
        });

        it('should remove dangerous characters', () => {
            expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
            expect(sanitizeFilename('file<script>.txt')).not.toContain('<');
        });

        it('should preserve file extensions', () => {
            const result = sanitizeFilename('document.pdf');
            expect(result).toMatch(/\.pdf$/);
        });
    });

    describe('IP Address Validation', () => {
        it('should validate IPv4 addresses', () => {
            expect(validateIPAddress('192.168.1.1')).toBe(true);
            expect(validateIPAddress('10.0.0.1')).toBe(true);
            expect(validateIPAddress('255.255.255.255')).toBe(true);
        });

        it('should validate IPv6 addresses', () => {
            expect(validateIPAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
            expect(validateIPAddress('::1')).toBe(true);
        });

        it('should reject invalid IP addresses', () => {
            expect(validateIPAddress('256.1.1.1')).toBe(false);
            expect(validateIPAddress('invalid')).toBe(false);
            expect(validateIPAddress('192.168.1')).toBe(false);
        });
    });

    describe('Zod Schema Validation', () => {
        it('should validate with Zod schemas', () => {
            const schema = z.object({
                name: z.string(),
                age: z.number().min(0).max(120),
            });

            const validData = { name: 'John', age: 30 };
            const result = schema.safeParse(validData);

            expect(result.success).toBe(true);
        });

        it('should return validation errors', () => {
            const schema = z.object({
                email: z.string().email(),
                age: z.number(),
            });

            const invalidData = { email: 'invalid', age: 'not-a-number' };
            const result = schema.safeParse(invalidData);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.errors).toHaveLength(2);
            }
        });
    });
});
