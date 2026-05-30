import { Router, type IRouter } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { addToCartSchema } from '@bookshop/shared';
import * as cartController from './cart.controller';

const router: IRouter = Router();

router.use(authenticate);
router.get('/', cartController.getCart);
router.post('/checkout', cartController.checkout);
router.post('/', validate(addToCartSchema), cartController.addToCart);
router.delete('/:bookId', cartController.removeFromCart);

export default router;
