/**
 * JWT Strategy Unit Tests
 * 
 * Tests for JWT authentication strategy
 */

import { JWTStrategy } from '../../../src/auth/strategies/jwt';
import { mockRequest, mockUser } from '../../utils/test-helpers';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
import jwt from 'jsonwebtoken';

describe('JWT Strategy', () => {
    let strategy: JWTStrategy;
    const mockConfig = {
        secret: 'test-secret',
        issuer: 'test-issuer',
        audience: 'test-audience',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
    };

    beforeEach(() => {
        strategy = new JWTStrategy(mockConfig);
        jest.clearAllMocks();
    });

    describe('Token Generation', () => {
        it('should generate valid JWT token', () => {
            const user = mockUser();
            const mockToken = 'mock.jwt.token';

            (jwt.sign as jest.Mock).mockReturnValue(mockToken);

            const token = strategy.generateToken(user);

            expect(token).toBe(mockToken);
            expect(jwt.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: user.id,
                    email: user.email,
                    tenant_id: user.tenant_id,
                    role: user.role,
                }),
                mockConfig.secret,
                expect.objectContaining({
                    expiresIn: mockConfig.expiresIn,
                    issuer: mockConfig.issuer,
                    audience: mockConfig.audience,
                })
            );
        });

        it('should include user payload in token', () => {
            const user = mockUser({
                id: 'user-456',
                email: 'custom@example.com',
                role: 'admin',
            });

            strategy.generateToken(user);

            expect(jwt.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: 'user-456',
                    email: 'custom@example.com',
                    role: 'admin',
                }),
                expect.any(String),
                expect.any(Object)
            );
        });

        it('should set correct expiration', () => {
            const user = mockUser();

            strategy.generateToken(user);

            expect(jwt.sign).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(String),
                expect.objectContaining({
                    expiresIn: '1h',
                })
            );
        });
    });

    describe('Token Verification', () => {
        it('should verify valid tokens', async () => {
            const mockPayload = {
                sub: 'user-123',
                email: 'test@example.com',
                role: 'user',
            };

            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(null, mockPayload);
            });

            const isValid = await strategy.validate('valid.token');

            expect(isValid).toBe(true);
            expect(jwt.verify).toHaveBeenCalled();
        });

        it('should reject invalid tokens', async () => {
            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(new Error('Invalid token'), null);
            });

            const isValid = await strategy.validate('invalid.token');

            expect(isValid).toBe(false);
        });

        it('should reject expired tokens', async () => {
            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                const error: any = new Error('Token expired');
                error.name = 'TokenExpiredError';
                callback(error, null);
            });

            const isValid = await strategy.validate('expired.token');

            expect(isValid).toBe(false);
        });

        it('should validate issuer and audience', async () => {
            const token = 'test.token';

            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(null, {});
            });

            await strategy.validate(token);

            expect(jwt.verify).toHaveBeenCalledWith(
                token,
                mockConfig.secret,
                expect.objectContaining({
                    issuer: mockConfig.issuer,
                    audience: mockConfig.audience,
                }),
                expect.any(Function)
            );
        });
    });

    describe('Token Refresh', () => {
        it('should generate refresh tokens', () => {
            const user = mockUser();
            const mockToken = 'refresh.token';

            (jwt.sign as jest.Mock).mockReturnValue(mockToken);

            const token = strategy.generateRefreshToken(user);

            expect(token).toBe(mockToken);
            expect(jwt.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: user.id,
                    type: 'refresh',
                }),
                mockConfig.secret,
                expect.objectContaining({
                    expiresIn: mockConfig.refreshExpiresIn,
                })
            );
        });

        it('should validate refresh tokens', async () => {
            const mockPayload = {
                sub: 'user-123',
                type: 'refresh',
            };

            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(null, mockPayload);
            });

            const user = await strategy.refresh('refresh.token');

            expect(user).toBeDefined();
            expect(user?.id).toBe('user-123');
        });

        it('should reject invalid refresh tokens', async () => {
            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(new Error('Invalid token'), null);
            });

            const user = await strategy.refresh('invalid.refresh.token');

            expect(user).toBeNull();
        });
    });

    describe('Token Extraction', () => {
        it('should extract token from Authorization header', async () => {
            const req = mockRequest({
                headers: {
                    authorization: 'Bearer valid.token',
                },
            });

            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(null, { sub: 'user-123', email: 'test@example.com' });
            });

            const user = await strategy.authenticate(req as any);

            expect(user).toBeDefined();
            expect(jwt.verify).toHaveBeenCalledWith(
                'valid.token',
                expect.any(String),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should extract token from query parameter', async () => {
            const req = mockRequest({
                query: {
                    token: 'query.token',
                },
            });

            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(null, { sub: 'user-123', email: 'test@example.com' });
            });

            const user = await strategy.authenticate(req as any);

            expect(user).toBeDefined();
        });

        it('should extract token from cookie', async () => {
            const req = mockRequest({
                cookies: {
                    token: 'cookie.token',
                },
            });

            (jwt.verify as jest.Mock).mockImplementation((token, secret, options, callback) => {
                callback(null, { sub: 'user-123', email: 'test@example.com' });
            });

            const user = await strategy.authenticate(req as any);

            expect(user).toBeDefined();
        });

        it('should return null when no token found', async () => {
            const req = mockRequest();

            const user = await strategy.authenticate(req as any);

            expect(user).toBeNull();
        });
    });
});
