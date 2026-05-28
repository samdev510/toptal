import { z } from 'zod';
import { PAGINATION } from '../constants';

export const createBookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).trim(),
  yearPublished: z
    .number()
    .int()
    .min(1000, 'Year must be at least 1000')
    .max(new Date().getFullYear() + 1, 'Year cannot be in the far future'),
  authorName: z.string().min(1, 'Author name is required').max(255).trim(),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Price has max 2 decimals'),
  categoryId: z.string().uuid('Invalid category ID'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  yearPublished: z
    .number()
    .int()
    .min(1000)
    .max(new Date().getFullYear() + 1)
    .optional(),
  authorName: z.string().min(1).max(255).trim().optional(),
  price: z.number().positive().multipleOf(0.01).optional(),
  categoryId: z.string().uuid().optional(),
});

export const bookQuerySchema = z.object({
  categories: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').filter(Boolean) : undefined)),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type BookQueryInput = z.infer<typeof bookQuerySchema>;
