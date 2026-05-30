import { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import * as ordersService from './orders.service';

export const list: RequestHandler = asyncHandler(async (req, res) => {
  res.json(await ordersService.getOrders(req.user!.userId));
});

export const getById: RequestHandler = asyncHandler(async (req, res) => {
  res.json(await ordersService.getOrderById(req.user!.userId, req.params.id as string));
});
