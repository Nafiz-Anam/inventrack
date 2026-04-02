import express from 'express';
import inventoryActivityController from '../../controllers/inventoryActivity.controller';
import auth from '../../middlewares/auth';

const router = express.Router();

router.get('/', auth('viewActivityLog'), inventoryActivityController.getActivities);
router.get('/recent', auth('viewActivityLog'), inventoryActivityController.getRecentActivities);

export default router;
