import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';

export async function checkout(userId: string) {
  const threshold = new Date(Date.now() - env.CART_EXPIRY_MINUTES * 60 * 1000);

  return prisma.$transaction(
    async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: {
          userId,
          addedAt: { gte: threshold },
        },
        include: { book: true },
      });

      if (cartItems.length === 0) {
        throw new AppError(400, 'Cart is empty');
      }

      const unavailable: string[] = [];
      for (const item of cartItems) {
        const book = await tx.book.findUnique({
          where: { id: item.bookId },
        });
        if (!book || book.stock <= 0) {
          unavailable.push(item.book.title);
        }
      }

      if (unavailable.length > 0) {
        throw new AppError(400, `Out of stock: ${unavailable.join(', ')}`);
      }

      let totalAmount = new Prisma.Decimal(0);
      for (const item of cartItems) {
        await tx.book.update({
          where: { id: item.bookId },
          data: { stock: { decrement: 1 } },
        });
        totalAmount = totalAmount.add(item.book.price);
      }

      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          items: {
            create: cartItems.map((item) => ({
              bookId: item.bookId,
              priceAtPurchase: item.book.price,
            })),
          },
        },
        include: {
          items: {
            include: {
              book: {
                select: { id: true, title: true, authorName: true },
              },
            },
          },
        },
      });

      await tx.cartItem.deleteMany({ where: { userId } });

      return order;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    },
  );
}

export async function getOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          book: {
            select: { id: true, title: true, authorName: true },
          },
        },
      },
    },
  });
}

export async function getOrderById(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          book: {
            select: { id: true, title: true, authorName: true },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  return order;
}
