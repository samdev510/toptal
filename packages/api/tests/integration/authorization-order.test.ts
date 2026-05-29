import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { cleanDatabase, prisma } from '../setup';

const fakeId = '00000000-0000-4000-8000-000000000001';

describe('auth before resource checks on admin mutations', () => {
  beforeEach(() => cleanDatabase());

  async function userToken() {
    const passwordHash = await bcrypt.hash('Password123', 12);
    await prisma.user.create({
      data: { email: 'user@test.com', passwordHash, role: 'USER' },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Password123' });
    return login.body.accessToken as string;
  }

  it.each([
    ['POST', '/api/categories', { name: 'X' }],
    ['PUT', '/api/categories', { name: 'X' }],
    ['PUT', `/api/categories/${fakeId}`, { name: 'X' }],
    [
      'POST',
      '/api/books',
      {
        title: 'T',
        yearPublished: 2024,
        authorName: 'A',
        price: 9.99,
        categoryId: fakeId,
        stock: 1,
      },
    ],
    ['PUT', '/api/books', { title: 'T' }],
    ['PUT', `/api/books/${fakeId}`, { title: 'T' }],
  ] as const)('unauthenticated %s returns 401 before 404', async (method, url, body) => {
    const res = await request(app)[method.toLowerCase() as 'post' | 'put'](url).send(body);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it.each([
    ['PUT', '/api/categories', { name: 'X' }],
    ['PUT', '/api/books', { title: 'T' }],
  ] as const)('admin %s without id returns 400 after auth', async (method, url, body) => {
    const passwordHash = await bcrypt.hash('Password123', 12);
    await prisma.user.create({
      data: { email: 'admin@test.com', passwordHash, role: 'ADMIN' },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123' });

    const res = await request(app)
      [method.toLowerCase() as 'put'](url)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id is required/i);
  });

  it.each([
    ['POST', '/api/categories', { name: 'X' }],
    ['PUT', `/api/categories/${fakeId}`, { name: 'X' }],
    ['PUT', `/api/books/${fakeId}`, { title: 'T' }],
  ] as const)('non-admin %s returns 403 before 404', async (method, url, body) => {
    const token = await userToken();
    const res = await request(app)
      [method.toLowerCase() as 'post' | 'put'](url)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(403);
  });
});
