import express from 'express';
import dashboardController from '../../controllers/dashboard.controller';
import auth from '../../middlewares/auth';

const router = express.Router();

router.get('/stats', auth('viewDashboard'), dashboardController.getDashboardStats);

export default router;
