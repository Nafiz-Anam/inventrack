import express from 'express';
import validate from '../../middlewares/validate';
import orderValidation from '../../validations/order.validation';
import orderController from '../../controllers/order.controller';
import auth from '../../middlewares/auth';

const router = express.Router();

router
  .route('/')
  .post(auth('manageOrders'), validate(orderValidation.createOrder), orderController.createOrder)
  .get(auth('manageOrders'), validate(orderValidation.getOrders), orderController.getOrders);

router
  .route('/:orderId')
  .get(auth('manageOrders'), validate(orderValidation.getOrder), orderController.getOrder)
  .delete(auth('deleteOrder'), validate(orderValidation.getOrder), orderController.deleteOrder);

router
  .route('/:orderId/status')
  .patch(auth('manageOrders'), validate(orderValidation.updateOrderStatus), orderController.updateOrderStatus);

router
  .route('/:orderId/cancel')
  .post(auth('manageOrders'), validate(orderValidation.cancelOrder), orderController.cancelOrder);

export default router;
