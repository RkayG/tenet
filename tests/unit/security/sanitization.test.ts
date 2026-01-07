/**
 * Sanitization Unit Tests
 * 
 * Tests for XSS protection and data sanitization
 */

import { sanitizeInput, sanitizeOutput, maskSensitiveData } from '../../../src/security/sanitization';

describe('Sanitization', () => {
    describe('XSS Protection', () => {
        it('should remove script tags', () => {
            const input = '<script>alert("xss")</script>Hello';
            const result = sanitizeInput(input);

            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert');
        });

        it('should escape HTML entities', () => {
            const input = '<img src=x onerror=alert(1)>';
            const result = sanitizeInput(input);

            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });

        it('should handle nested XSS attempts', () => {
            const input = '<div><script>alert("nested")</script></div>';
            const result = sanitizeInput(input);

            expect(result).not.toContain('<script>');
        });

        it('should preserve safe HTML', () => {
            const input = '<p>Safe paragraph</p>';
            const result = sanitizeInput(input, { allowHtml: true });

            expect(result).toContain('<p>');
            expect(result).toContain('Safe paragraph');
        });

        it('should sanitize object properties', () => {
            const input = {
                name: '<script>alert("xss")</script>John',
                bio: 'Safe text',
            };

            const result = sanitizeInput(input);

            expect(result.name).not.toContain('<script>');
            expect(result.bio).toBe('Safe text');
        });

        it('should sanitize arrays', () => {
            const input = [
                '<script>alert(1)</script>',
                'Safe text',
                '<img src=x onerror=alert(2)>',
            ];

            const result = sanitizeInput(input);

            expect(result[0]).not.toContain('<script>');
            expect(result[1]).toBe('Safe text');
            expect(result[2]).not.toContain('onerror');
        });
    });

    describe('SQL Injection Prevention', () => {
        it('should escape SQL special characters', () => {
            const input = "'; DROP TABLE users; --";
            const result = sanitizeInput(input);

            expect(result).not.toContain('DROP TABLE');
        });

        it('should handle parameterized query patterns', () => {
            const input = "admin' OR '1'='1";
            const result = sanitizeInput(input);

            expect(result).not.toMatch(/OR.*=/);
        });
    });

    describe('Sensitive Data Masking', () => {
        it('should mask credit card numbers', () => {
            const data = {
                cardNumber: '4111111111111111',
                name: 'John Doe',
            };

            const result = maskSensitiveData(data);

            expect(result.cardNumber).toMatch(/\*{12}\d{4}/);
            expect(result.name).toBe('John Doe');
        });

        it('should mask SSN', () => {
            const data = {
                ssn: '123-45-6789',
            };

            const result = maskSensitiveData(data);

            expect(result.ssn).toMatch(/\*{3}-\*{2}-\d{4}/);
        });

        it('should mask email addresses', () => {
            const data = {
                email: 'john.doe@example.com',
            };

            const result = maskSensitiveData(data);

            expect(result.email).toMatch(/j\*{6}@example.com/);
        });

        it('should preserve data structure', () => {
            const data = {
                user: {
                    email: 'test@example.com',
                    ssn: '123-45-6789',
                },
                metadata: {
                    ip: '192.168.1.1',
                },
            };

            const result = maskSensitiveData(data);

            expect(result.user).toBeDefined();
            expect(result.user.email).toContain('*');
            expect(result.metadata.ip).toBe('192.168.1.1');
        });
    });

    describe('Output Sanitization', () => {
        it('should sanitize response data', () => {
            const output = {
                message: '<script>alert("xss")</script>Success',
                data: {
                    name: 'John',
                },
            };

            const result = sanitizeOutput(output);

            expect(result.message).not.toContain('<script>');
        });

        it('should handle null and undefined', () => {
            expect(sanitizeInput(null)).toBeNull();
            expect(sanitizeInput(undefined)).toBeUndefined();
        });

        it('should handle numbers and booleans', () => {
            expect(sanitizeInput(123)).toBe(123);
            expect(sanitizeInput(true)).toBe(true);
        });
    });
});
