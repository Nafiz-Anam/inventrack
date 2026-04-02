import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { pushNotificationValidation } from '../../validations';
import { pushNotificationLimiter } from '../../middlewares/rateLimiter';
import {
  getPushPreferences,
  updatePushPreferences,
  testPushNotification,
  getWebSocketStatus,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from '../../controllers/pushNotification.controller';

const router = express.Router();

// All routes require authentication
router.use(auth());

router
  .route('/push-preferences')
  .get(getPushPreferences)
  .put(
    pushNotificationLimiter,
    validate({ body: pushNotificationValidation.updatePreferences }),
    updatePushPreferences
  );

router.post(
  '/test-push-notification',
  pushNotificationLimiter,
  validate({ body: pushNotificationValidation.testNotification }),
  testPushNotification
);
router.get('/ws-status', getWebSocketStatus);
router.post(
  '/subscribe-notifications',
  pushNotificationLimiter,
  validate({ body: pushNotificationValidation.subscribeNotifications }),
  subscribeToNotifications
);
router.delete(
  '/unsubscribe-notifications',
  pushNotificationLimiter,
  validate({ body: pushNotificationValidation.unsubscribeNotifications }),
  unsubscribeFromNotifications
);

export default router;
