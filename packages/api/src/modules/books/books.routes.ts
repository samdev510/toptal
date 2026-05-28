import { Router, type IRouter } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createBookSchema, updateBookSchema } from '@bookshop/shared';
import * as booksController from './books.controller';

const router: IRouter = Router();

router.get('/', booksController.list);
router.get('/:id', booksController.getById);
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createBookSchema),
  booksController.create,
);
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(updateBookSchema),
  booksController.update,
);
router.delete('/:id', authenticate, authorize('ADMIN'), booksController.remove);

export default router;
