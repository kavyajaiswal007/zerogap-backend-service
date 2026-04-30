import { z } from 'zod';

const STOCK_PASSWORD = 'ZeroGap123!';

function makeStockEmail(value: unknown) {
  const slug = String(value ?? 'zerogap-user')
    .toLowerCase()
    .replace(/@.*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'zerogap-user';
  return `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

const emailSchema = z.preprocess((value) => {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : makeStockEmail(email);
}, z.string().email());

const passwordSchema = z.preprocess((value) => {
  const password = String(value ?? '');
  return password.trim().length >= 8 ? password : STOCK_PASSWORD;
}, z.string().min(8));

const fullNameSchema = z.preprocess((value) => {
  const name = String(value ?? '').trim();
  return name.length >= 2 ? name : 'ZeroGap User';
}, z.string().min(2));

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  role: z.enum(['student', 'college', 'recruiter', 'mentor', 'parent', 'admin']).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  newPassword: z.string().min(8),
});
