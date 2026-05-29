import { Router, type IRouter } from 'express';
import { validate } from '../../middleware/validate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { AppError } from '../../middleware/errorHandler';
import { createBookSchema, updateBookSchema } from '@bookshop/shared';
import * as booksController from './books.controller';

const router: IRouter = Router();

router.get('/', booksController.list);
router.get('/:id', booksController.getById);
router.post('/', ...requireAdmin, validate(createBookSchema), booksController.create);
router.put('/', ...requireAdmin, (_req, _res, next) => {
  next(new AppError(400, 'Book id is required'));
});
router.put('/:id', ...requireAdmin, validate(updateBookSchema), booksController.update);
router.delete('/:id', ...requireAdmin, booksController.remove);

export default router;
