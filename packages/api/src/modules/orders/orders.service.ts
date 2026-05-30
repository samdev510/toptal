import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

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
