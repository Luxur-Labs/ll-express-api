import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from './setup';
import { prisma } from '../src/utils/prisma';
import { env } from '../src/config/env';

describe('Auth session management', () => {
  const email = 'session-test@example.com';
  const password = 'sessionpass123';

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true, tokenVersion: 0, role: 'LAB_MANAGER' },
      create: {
        email,
        passwordHash,
        role: 'LAB_MANAGER',
        isActive: true,
        tokenVersion: 0,
      },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it('login returns access and refresh tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('refresh rotates tokens', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    const refreshToken = login.body.refreshToken as string;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('reused refresh token is rejected', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    const refreshToken = login.body.refreshToken as string;

    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(first.status).toBe(200);

    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_INVALID');

    const secondNew = first.body.refreshToken as string;
    const stillValid = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondNew });
    expect(stillValid.status).toBe(200);
  });

  it('logout revokes refresh token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    const token = login.body.token as string;
    const refreshToken = login.body.refreshToken as string;

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken });
    expect(logout.status).toBe(200);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refresh.status).toBe(401);
    expect(refresh.body.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('refresh requires refreshToken body', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('password change invalidates old access token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    const oldToken = login.body.token as string;

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: password, newPassword: 'newpass456' });
    expect(change.status).toBe(200);
    expect(change.body.token).toBeTruthy();

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(me.status).toBe(401);
    expect(me.body.code).toBe('SESSION_INVALIDATED');

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'newpass456' });
    expect(newLogin.status).toBe(200);

    await prisma.user.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password, 10), tokenVersion: 0 },
    });
    await prisma.refreshToken.deleteMany({ where: { user: { email } } });
  });

  it('revoked account returns ACCOUNT_REVOKED', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    const token = login.body.token as string;
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();

    await prisma.user.update({
      where: { email },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('ACCOUNT_REVOKED');

    await prisma.user.update({
      where: { email },
      data: { isActive: true },
    });
  });

  it('legacy token without tokenVersion is treated as version 0', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    await prisma.user.update({
      where: { email },
      data: { tokenVersion: 0 },
    });

    const legacyToken = jwt.sign(
      { id: user!.id, email, role: 'LAB_MANAGER' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${legacyToken}`);
    expect(me.status).toBe(200);
  });
});
