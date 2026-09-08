/**
 * budgets.routes.js - Budgets API Routes
 */

import { Router } from 'express';
import { budgetsController } from '../controllers/budgets.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', budgetsController.getAll);
router.post('/test-email', budgetsController.sendTestEmail);
router.get('/alerts/:monthKey', budgetsController.getAlerts);
router.get('/:monthKey', budgetsController.getForMonth);
router.put('/:monthKey', budgetsController.setBudget);

export default router;
