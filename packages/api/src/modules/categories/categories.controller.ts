import { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import * as categoriesService from './categories.service';

export const list: RequestHandler = asyncHandler(async (_req, res) => {
  res.json(await categoriesService.listCategories());
});

export const getById: RequestHandler = asyncHandler(async (req, res) => {
  res.json(await categoriesService.getCategoryById(req.params.id as string));
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const category = await categoriesService.createCategory(req.body);
  res.status(201).json(category);
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  res.json(await categoriesService.updateCategory(req.params.id as string, req.body));
});

export const remove: RequestHandler = asyncHandler(async (req, res) => {
  await categoriesService.deleteCategory(req.params.id as string);
  res.status(204).send();
});
