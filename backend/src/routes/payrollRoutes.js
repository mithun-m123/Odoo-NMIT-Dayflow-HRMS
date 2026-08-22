const express = require('express');
const payrollController = require('../controllers/payrollController');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateSalaryRules } = require('../middleware/validators/payrollValidators');

const router = express.Router();

router.use(authenticate);

router.get('/me', payrollController.getMyPayroll);

router.get('/', requireRole('ADMIN'), payrollController.listAllPayroll);
router.get('/:employeeId', requireRole('ADMIN'), payrollController.getPayrollByEmployee);
router.put(
  '/:employeeId',
  requireRole('ADMIN'),
  updateSalaryRules,
  validate,
  payrollController.updateSalaryStructure
);

module.exports = router;
