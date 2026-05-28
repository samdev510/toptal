import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 12);

  await prisma.user.upsert({
    where: { email: 'admin@bookshop.com' },
    update: {},
    create: {
      email: 'admin@bookshop.com',
      passwordHash: await hash('Admin123!'),
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@bookshop.com' },
    update: {},
    create: {
      email: 'user@bookshop.com',
      passwordHash: await hash('User1234!'),
      role: 'USER',
    },
  });

  const catNames = ['Fiction', 'Non-Fiction', 'Science', 'History', 'Technology', 'Philosophy'];
  const categories = [];
  for (const name of catNames) {
    categories.push(
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    );
  }

  if ((await prisma.book.count()) === 0) {
    await prisma.book.createMany({
      data: [
        {
          title: 'The Great Gatsby',
          yearPublished: 1925,
          authorName: 'F. Scott Fitzgerald',
          price: 12.99,
          stock: 15,
          categoryId: categories[0].id,
        },
        {
          title: '1984',
          yearPublished: 1949,
          authorName: 'George Orwell',
          price: 14.99,
          stock: 20,
          categoryId: categories[0].id,
        },
        {
          title: 'To Kill a Mockingbird',
          yearPublished: 1960,
          authorName: 'Harper Lee',
          price: 11.99,
          stock: 10,
          categoryId: categories[0].id,
        },
        {
          title: 'Sapiens',
          yearPublished: 2011,
          authorName: 'Yuval Noah Harari',
          price: 18.99,
          stock: 25,
          categoryId: categories[1].id,
        },
        {
          title: 'A Brief History of Time',
          yearPublished: 1988,
          authorName: 'Stephen Hawking',
          price: 16.99,
          stock: 18,
          categoryId: categories[2].id,
        },
        {
          title: 'Clean Code',
          yearPublished: 2008,
          authorName: 'Robert C. Martin',
          price: 34.99,
          stock: 22,
          categoryId: categories[4].id,
        },
      ],
    });
  }

  console.info('seed done — admin@bookshop.com / user@bookshop.com (see README)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
