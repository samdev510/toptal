import request from 'supertest';
import app from '../../src/app';
import { cleanDatabase, prisma } from '../setup';
import bcrypt from 'bcrypt';

async function loginAsAdmin() {
  const passwordHash = await bcrypt.hash('Password123', 12);
  await prisma.user.create({
    data: { email: 'admin@test.com', passwordHash, role: 'ADMIN' },
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'Password123' });
  return res.body.accessToken as string;
}

describe('categories', () => {
  let adminToken: string;

  beforeEach(async () => {
    await cleanDatabase();
    adminToken = await loginAsAdmin();
  });

  it('lists without auth', async () => {
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fiction' });

    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Fiction');
  });

  it('admin can create', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Science' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Science');
  });

  it('non-admin cannot create', async () => {
    const passwordHash = await bcrypt.hash('Password123', 12);
    await prisma.user.create({
      data: { email: 'user@test.com', passwordHash, role: 'USER' },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Password123' });

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(403);
  });

  it('cannot delete category that has books', async () => {
    const cat = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Has Books' });

    await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Book',
        yearPublished: 2024,
        authorName: 'Author',
        price: 9.99,
        categoryId: cat.body.id,
        stock: 5,
      });

    const res = await request(app)
      .delete(`/api/categories/${cat.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});
