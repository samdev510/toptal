import { Router, type IRouter } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createCategorySchema, updateCategorySchema } from '@bookshop/shared';
import * as categoriesController from './categories.controller';

const router: IRouter = Router();

router.get('/', categoriesController.list);
router.get('/:id', categoriesController.getById);
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createCategorySchema),
  categoriesController.create,
);
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateCategorySchema),
  categoriesController.update,
);
router.delete('/:id', authenticate, authorize('ADMIN'), categoriesController.remove);

export default router;
