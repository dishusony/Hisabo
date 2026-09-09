/**
 * auth.routes.js - Authentication Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/config', authController.getConfig);
router.post('/send-otp', authController.sendOtp);
router.post('/signup', authController.signup);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/login', authController.login);
router.get('/mail-status', authController.getMailStatus);
router.post('/configure-mail', authController.configureMail);
router.post('/enable-dev-mode', authController.enableDevMode);
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', requireAuth, authController.logout);

export default router;
