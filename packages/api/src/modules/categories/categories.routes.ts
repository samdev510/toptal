import { Router, type IRouter } from 'express';
import { validate } from '../../middleware/validate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { AppError } from '../../middleware/errorHandler';
import { createCategorySchema, updateCategorySchema } from '@bookshop/shared';
import * as categoriesController from './categories.controller';

const router: IRouter = Router();

router.get('/', categoriesController.list);
router.get('/:id', categoriesController.getById);
router.post('/', ...requireAdmin, validate(createCategorySchema), categoriesController.create);
router.put('/', ...requireAdmin, (_req, _res, next) => {
  next(new AppError(400, 'Category id is required'));
});
router.put('/:id', ...requireAdmin, validate(updateCategorySchema), categoriesController.update);
router.delete('/:id', ...requireAdmin, categoriesController.remove);

export default router;
