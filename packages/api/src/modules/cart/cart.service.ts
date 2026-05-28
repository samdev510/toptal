import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';

function getExpiryThreshold(): Date {
  return new Date(Date.now() - env.CART_EXPIRY_MINUTES * 60 * 1000);
}

export async function getCart(userId: string) {
  const threshold = getExpiryThreshold();

  const items = await prisma.cartItem.findMany({
    where: {
      userId,
      addedAt: { gte: threshold },
    },
    include: {
      book: {
        include: { category: { select: { id: true, name: true } } },
      },
    },
    orderBy: { addedAt: 'desc' },
  });

  return items;
}

export async function addToCart(userId: string, bookId: string) {
  const threshold = getExpiryThreshold();

  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book) {
      throw new AppError(404, 'Book not found');
    }

    if (book.stock <= 0) {
      throw new AppError(400, 'Book is out of stock');
    }

    const existingCartItem = await tx.cartItem.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    if (existingCartItem) {
      if (existingCartItem.addedAt >= threshold) {
        throw new AppError(409, 'Already in cart');
      }
      await tx.cartItem.delete({ where: { id: existingCartItem.id } });
    }

    const activeReservations = await tx.cartItem.count({
      where: {
        bookId,
        addedAt: { gte: threshold },
      },
    });

    const effectiveStock = book.stock - activeReservations;
    if (effectiveStock <= 0) {
      throw new AppError(400, 'No copies left');
    }

    return tx.cartItem.create({
      data: { userId, bookId },
      include: {
        book: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });
  });
}

export async function removeFromCart(userId: string, bookId: string) {
  const item = await prisma.cartItem.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });

  if (!item) {
    throw new AppError(404, 'Book not found in cart');
  }

  await prisma.cartItem.delete({ where: { id: item.id } });
}

export async function cleanupExpiredCarts() {
  const threshold = getExpiryThreshold();
  const result = await prisma.cartItem.deleteMany({
    where: { addedAt: { lt: threshold } },
  });
  return result.count;
}
