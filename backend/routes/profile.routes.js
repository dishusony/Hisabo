/**
 * profile.routes.js - User Profile & Settings Routes
 */

import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.get('/settings', profileController.getSettings);
router.put('/settings', profileController.updateSettings);
router.delete('/account', profileController.deleteAccount);

export default router;
