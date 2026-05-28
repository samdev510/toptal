import { RequestHandler } from 'express';
import { bookQuerySchema } from '@bookshop/shared';
import { asyncHandler } from '../../middleware/asyncHandler';
import * as booksService from './books.service';

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const query = bookQuerySchema.parse(req.query);
  res.json(await booksService.listBooks(query));
});

export const getById: RequestHandler = asyncHandler(async (req, res) => {
  res.json(await booksService.getBookById(req.params.id as string));
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const book = await booksService.createBook(req.body);
  res.status(201).json(book);
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  res.json(await booksService.updateBook(req.params.id as string, req.body));
});

export const remove: RequestHandler = asyncHandler(async (req, res) => {
  await booksService.deleteBook(req.params.id as string);
  res.status(204).send();
});
