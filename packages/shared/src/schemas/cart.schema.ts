import { z } from 'zod';

export const addToCartSchema = z.object({
  bookId: z.string().uuid('Invalid book ID'),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
