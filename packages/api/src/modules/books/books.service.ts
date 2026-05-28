import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateBookInput, UpdateBookInput, BookQueryInput } from '@bookshop/shared';

export async function listBooks(query: BookQueryInput) {
  const { categories, search, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.BookWhereInput = {
    stock: { gt: 0 },
  };

  if (categories && categories.length > 0) {
    where.categoryId = { in: categories };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { authorName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.book.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.book.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getBookById(id: string) {
  const book = await prisma.book.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!book) {
    throw new AppError(404, 'Book not found');
  }
  return book;
}

export async function createBook(data: CreateBookInput) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) {
    throw new AppError(400, 'Category not found');
  }

  return prisma.book.create({
    data: {
      title: data.title,
      yearPublished: data.yearPublished,
      authorName: data.authorName,
      price: new Prisma.Decimal(data.price),
      stock: data.stock,
      categoryId: data.categoryId,
    },
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function updateBook(id: string, data: UpdateBookInput) {
  await getBookById(id);

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new AppError(400, 'Category not found');
    }
  }

  const updateData: Prisma.BookUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.yearPublished !== undefined) updateData.yearPublished = data.yearPublished;
  if (data.authorName !== undefined) updateData.authorName = data.authorName;
  if (data.price !== undefined) updateData.price = new Prisma.Decimal(data.price);
  if (data.categoryId !== undefined) updateData.category = { connect: { id: data.categoryId } };

  return prisma.book.update({
    where: { id },
    data: updateData,
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function deleteBook(id: string) {
  await getBookById(id);

  const orderCount = await prisma.orderItem.count({ where: { bookId: id } });
  if (orderCount > 0) {
    throw new AppError(400, 'Book has orders');
  }

  await prisma.cartItem.deleteMany({ where: { bookId: id } });
  return prisma.book.delete({ where: { id } });
}
