import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateCategoryInput, UpdateCategoryInput } from '@bookshop/shared';

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { books: true } } },
  });
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new AppError(404, 'Category not found');
  }
  return category;
}

export async function createCategory(data: CreateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new AppError(409, 'Category name taken');
  }
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, data: UpdateCategoryInput) {
  await getCategoryById(id);

  if (data.name) {
    const existing = await prisma.category.findFirst({
      where: { name: data.name, NOT: { id } },
    });
    if (existing) {
      throw new AppError(409, 'Category name taken');
    }
  }

  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  await getCategoryById(id);

  const bookCount = await prisma.book.count({ where: { categoryId: id } });
  if (bookCount > 0) {
    throw new AppError(400, 'Category still has books');
  }

  return prisma.category.delete({ where: { id } });
}
