import express from 'express';
import validate from '../../middlewares/validate';
import categoryValidation from '../../validations/category.validation';
import categoryController from '../../controllers/category.controller';
import auth from '../../middlewares/auth';

const router = express.Router();

router
  .route('/')
  .post(auth('manageCategories'), validate(categoryValidation.createCategory), categoryController.createCategory)
  .get(auth('manageCategories'), validate(categoryValidation.getCategories), categoryController.getCategories);

router
  .route('/:categoryId')
  .get(auth('manageCategories'), validate(categoryValidation.getCategory), categoryController.getCategory)
  .patch(auth('manageCategories'), validate(categoryValidation.updateCategory), categoryController.updateCategory)
  .delete(auth('deleteCategory'), validate(categoryValidation.deleteCategory), categoryController.deleteCategory);

export default router;
