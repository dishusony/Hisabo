/**
 * analytics.routes.js - Analytics & Insights API Routes
 */

import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/kpis', analyticsController.getKPIs);

export default router;
