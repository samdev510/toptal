import request from 'supertest';
import app from '../../src/app';
import { cleanDatabase, prisma } from '../setup';
import bcrypt from 'bcrypt';

async function seedUsersAndBook() {
  const passwordHash = await bcrypt.hash('Password123', 12);
  await prisma.user.createMany({
    data: [
      { email: 'admin@test.com', passwordHash, role: 'ADMIN' },
      { email: 'u1@test.com', passwordHash, role: 'USER' },
      { email: 'u2@test.com', passwordHash, role: 'USER' },
    ],
  });

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'Password123' });
  const u1Login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'u1@test.com', password: 'Password123' });
  const u2Login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'u2@test.com', password: 'Password123' });

  const cat = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
    .send({ name: 'Fiction' });

  const book = await request(app)
    .post('/api/books')
    .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
    .send({
      title: 'Test Book',
      yearPublished: 2024,
      authorName: 'Author',
      price: 19.99,
      categoryId: cat.body.id,
      stock: 2,
    });

  return {
    adminToken: adminLogin.body.accessToken,
    user1Token: u1Login.body.accessToken,
    user2Token: u2Login.body.accessToken,
    categoryId: cat.body.id,
    bookId: book.body.id,
  };
}

describe('cart + checkout', () => {
  beforeEach(() => cleanDatabase());

  it('add to cart and checkout', async () => {
    const { user1Token, bookId } = await seedUsersAndBook();

    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ bookId });

    const order = await request(app)
      .post('/api/cart/checkout')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(order.status).toBe(201);
    expect(order.body.items).toHaveLength(1);

    const cart = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(cart.body).toHaveLength(0);
  });

  it('only one buyer gets the last copy', async () => {
    const { adminToken, user1Token, user2Token, categoryId } = await seedUsersAndBook();

    const rare = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Rare',
        yearPublished: 2024,
        authorName: 'Author',
        price: 29.99,
        categoryId,
        stock: 1,
      });

    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ bookId: rare.body.id });

    await prisma.cartItem.create({
      data: {
        userId: (await prisma.user.findUnique({ where: { email: 'u2@test.com' } }))!.id,
        bookId: rare.body.id,
      },
    });

    const [a, b] = await Promise.all([
      request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${user1Token}`),
      request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${user2Token}`),
    ]);

    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);
  });
});
