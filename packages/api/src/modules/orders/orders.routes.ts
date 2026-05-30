import { Router, type IRouter } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as ordersController from './orders.controller';

const router: IRouter = Router();

router.use(authenticate);
router.get('/', ordersController.list);
router.get('/:id', ordersController.getById);

export default router;
