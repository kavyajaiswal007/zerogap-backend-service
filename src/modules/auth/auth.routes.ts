import { Router } from 'express';
import { validate } from '../../middleware/validation.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { AuthController } from './auth.controller.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schema.js';

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, college, recruiter, mentor, parent, admin]
 *           example:
 *             email: testuser1@example.com
 *             password: StrongPass123
 *             fullName: Test User
 *     responses:
 *       201:
 *         description: Registration successful
 */
authRouter.post('/register', validate(registerSchema), AuthController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *           example:
 *             email: testuser1@example.com
 *             password: StrongPass123
 *     responses:
 *       200:
 *         description: Login successful
 */
authRouter.post('/login', validate(loginSchema), AuthController.login);
authRouter.post('/logout', requireAuth, AuthController.logout);
authRouter.post('/refresh', validate(refreshSchema), AuthController.refresh);
authRouter.get('/github', AuthController.github);
authRouter.get('/github/callback', AuthController.githubCallback);
authRouter.get('/google', AuthController.google);
authRouter.get('/google/callback', AuthController.googleCallback);
authRouter.post('/forgot-password', validate(forgotPasswordSchema), AuthController.forgotPassword);
authRouter.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 */
authRouter.get('/me', requireAuth, AuthController.me);
