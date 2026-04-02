import express from 'express';
import validate from '../../middlewares/validate';
import restockValidation from '../../validations/restock.validation';
import restockController from '../../controllers/restock.controller';
import auth from '../../middlewares/auth';

const router = express.Router();

router
  .route('/')
  .get(auth('viewRestockQueue'), validate(restockValidation.getRestockQueue), restockController.getRestockQueue);

router
  .route('/:restockId/restock')
  .post(auth('restockProducts'), validate(restockValidation.restockProduct), restockController.restockProduct);

router
  .route('/:restockId')
  .delete(auth('restockProducts'), validate(restockValidation.deleteRestockEntry), restockController.deleteRestockEntry);

export default router;
