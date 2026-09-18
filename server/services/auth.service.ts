import { usersRepo, type UserRow } from '../db/repositories/users.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { createSessionToken, type AuthUser } from '../middleware/auth.middleware.js';

export class AuthService {
  async login(username: string, password: string, ip: string = '127.0.0.1'): Promise<{ user: AuthUser; token: string }> {
    const trimmed = username.trim();
    const user = await usersRepo.findByUsernameOrEmail(trimmed);

    // Constant-time check even if user not found to prevent timing enumeration
    const dummyHash = 'a'.repeat(128);
    const dummySalt = 'b'.repeat(32);
    const isValid = user
      ? verifyPassword(password, user.password_hash, user.password_salt)
      : (verifyPassword(password, dummyHash, dummySalt), false);

    if (!user || !isValid) {
      await auditRepo.log(null, 'LOGIN_FAILED', 'user', null, { attemptedUsername: trimmed }, ip);
      const err = new Error('Invalid username or password.');
      (err as any).statusCode = 401;
      throw err;
    }

    if (user.status !== 'active') {
      const err = new Error('This user account has been deactivated.');
      (err as any).statusCode = 403;
      throw err;
    }

    await usersRepo.updateLastLogin(user.id);

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      preferred_currency: user.preferred_currency || 'USD'
    };

    const token = createSessionToken(authUser);
    await auditRepo.log(authUser, 'LOGIN_SUCCESS', 'user', user.id, {}, ip);

    return { user: authUser, token };
  }

  async getMe(userId: string): Promise<UserRow> {
    const user = await usersRepo.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      (err as any).statusCode = 404;
      throw err;
    }
    return user;
  }

  async updateProfile(
    userId: string,
    payload: {
      name: string;
      username: string;
      email: string;
      preferred_currency?: string;
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    },
    ip: string = '127.0.0.1'
  ): Promise<{ user: AuthUser; token: string; message: string }> {
    const user = await usersRepo.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const cleanUsername = payload.username.trim();
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim();

    // Check conflict
    const existing = await usersRepo.findByUsernameOrEmail(cleanUsername);
    if (existing && existing.id !== userId) {
      const err = new Error('This username is already taken by another account.');
      (err as any).statusCode = 400;
      throw err;
    }

    const existingEmail = await usersRepo.findByUsernameOrEmail(cleanEmail);
    if (existingEmail && existingEmail.id !== userId) {
      const err = new Error('This email is already taken by another account.');
      (err as any).statusCode = 400;
      throw err;
    }

    let updatedHash = user.password_hash;
    let updatedSalt = user.password_salt;
    let passwordChanged = false;

    if (payload.currentPassword || payload.newPassword || payload.confirmPassword) {
      if (!payload.currentPassword) {
        const err = new Error('Current password is required to set a new password.');
        (err as any).statusCode = 400;
        throw err;
      }
      if (!verifyPassword(payload.currentPassword, user.password_hash, user.password_salt)) {
        await auditRepo.log({ id: user.id, username: user.username }, 'FAILED_PASSWORD_VERIFY', 'user', userId, {}, ip);
        const err = new Error('Current password is incorrect.');
        (err as any).statusCode = 400;
        throw err;
      }
      if (!payload.newPassword || payload.newPassword.length < 8) {
        const err = new Error('New password must be at least 8 characters.');
        (err as any).statusCode = 400;
        throw err;
      }
      if (payload.newPassword !== payload.confirmPassword) {
        const err = new Error('New password and confirmation do not match.');
        (err as any).statusCode = 400;
        throw err;
      }
      const p = hashPassword(payload.newPassword);
      updatedHash = p.hash;
      updatedSalt = p.salt;
      passwordChanged = true;
    }

    const updated = await usersRepo.update(userId, {
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      preferred_currency: payload.preferred_currency || user.preferred_currency || 'USD',
      password_hash: updatedHash,
      password_salt: updatedSalt
    });

    const authUser: AuthUser = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      role: user.role,
      avatar: user.avatar,
      preferred_currency: updated?.preferred_currency || 'USD'
    };

    const token = createSessionToken(authUser);
    await auditRepo.log(authUser, 'UPDATE_PROFILE', 'user', userId, { passwordChanged }, ip);

    return {
      user: authUser,
      token,
      message: passwordChanged ? 'Profile and password updated successfully.' : 'Profile updated successfully.'
    };
  }

  async updateCurrency(userId: string, currency: string): Promise<string> {
    const code = currency.trim().toUpperCase();
    await usersRepo.update(userId, { preferred_currency: code });
    return code;
  }

  async changePassword(userId: string, currentPass: string, newPass: string, ip: string = '127.0.0.1'): Promise<void> {
    const user = await usersRepo.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (!verifyPassword(currentPass, user.password_hash, user.password_salt)) {
      await auditRepo.log({ id: user.id, username: user.username }, 'FAILED_PASSWORD_CHANGE', 'user', userId, {}, ip);
      const err = new Error('Current password is incorrect.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!newPass || newPass.length < 8) {
      const err = new Error('New password must be at least 8 characters.');
      (err as any).statusCode = 400;
      throw err;
    }

    const { hash, salt } = hashPassword(newPass);
    await usersRepo.update(userId, {
      password_hash: hash,
      password_salt: salt
    });

    await auditRepo.log({ id: user.id, username: user.username }, 'PASSWORD_CHANGED', 'user', userId, {}, ip);
  }
}

export const authService = new AuthService();
