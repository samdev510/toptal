import request from 'supertest';
import app from '../../src/app';
import { cleanDatabase, prisma } from '../setup';
import bcrypt from 'bcrypt';

describe('books', () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const passwordHash = await bcrypt.hash('Password123', 12);
    await prisma.user.create({
      data: { email: 'admin@test.com', passwordHash, role: 'ADMIN' },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123' });
    adminToken = login.body.accessToken;

    const cat = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fiction' });
    categoryId = cat.body.id;
  });

  it('hides sold-out books from listing', async () => {
    await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'In stock',
        yearPublished: 2024,
        authorName: 'Author',
        price: 9.99,
        categoryId,
        stock: 2,
      });
    await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Gone',
        yearPublished: 2024,
        authorName: 'Author',
        price: 9.99,
        categoryId,
        stock: 0,
      });

    const res = await request(app).get('/api/books');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('In stock');
  });

  it('admin can create and update (not stock)', async () => {
    const created = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Original',
        yearPublished: 2024,
        authorName: 'Author',
        price: 9.99,
        categoryId,
        stock: 10,
      });

    const updated = await request(app)
      .put(`/api/books/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Renamed', price: 14.99 });

    expect(updated.body.title).toBe('Renamed');
    expect(updated.body.stock).toBe(10);
  });
});
