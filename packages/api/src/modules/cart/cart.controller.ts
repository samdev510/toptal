import { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import * as cartService from './cart.service';

export const getCart: RequestHandler = asyncHandler(async (req, res) => {
  res.json(await cartService.getCart(req.user!.userId));
});

export const addToCart: RequestHandler = asyncHandler(async (req, res) => {
  const item = await cartService.addToCart(req.user!.userId, req.body.bookId);
  res.status(201).json(item);
});

export const removeFromCart: RequestHandler = asyncHandler(async (req, res) => {
  await cartService.removeFromCart(req.user!.userId, req.params.bookId as string);
  res.status(204).send();
});
