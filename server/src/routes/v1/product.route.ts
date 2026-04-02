import express from 'express';
import validate from '../../middlewares/validate';
import productValidation from '../../validations/product.validation';
import productController from '../../controllers/product.controller';
import auth from '../../middlewares/auth';

const router = express.Router();

router
  .route('/')
  .post(auth('manageProducts'), validate(productValidation.createProduct), productController.createProduct)
  .get(auth('manageProducts'), validate(productValidation.getProducts), productController.getProducts);

router
  .route('/:productId')
  .get(auth('manageProducts'), validate(productValidation.getProduct), productController.getProduct)
  .patch(auth('manageProducts'), validate(productValidation.updateProduct), productController.updateProduct)
  .delete(auth('deleteProduct'), validate(productValidation.deleteProduct), productController.deleteProduct);

export default router;
