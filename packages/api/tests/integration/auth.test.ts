import request from 'supertest';
import app from '../../src/app';
import { cleanDatabase } from '../setup';

describe('auth', () => {
  beforeEach(() => cleanDatabase());

  it('registers', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('blocks duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'Password456',
    });

    expect(res.status).toBe(409);
  });

  it('login works', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('refresh rotates token', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: reg.body.refreshToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(reg.body.refreshToken);

    const again = await request(app).post('/api/auth/refresh').send({
      refreshToken: reg.body.refreshToken,
    });
    expect(again.status).toBe(401);
  });

  it('logout kills refresh token', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'Password123',
    });

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ refreshToken: reg.body.refreshToken });

    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: reg.body.refreshToken,
    });
    expect(res.status).toBe(401);
  });
});
