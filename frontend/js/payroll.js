/**
 * payroll.js — Employee payroll view (read-only per SRS 3.6.1)
 *             + Admin salary update panel (SRS 3.6.2)
 */

requireAuth();

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', logout);

// Show admin sidebar link
if (Auth.isAdmin()) {
  const al = document.getElementById('adminLink');
  if (al) al.style.display = 'flex';
  const adminSection = document.getElementById('adminSalarySection');
  if (adminSection) adminSection.style.display = 'block';
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const netPayHeading   = document.getElementById('netPayHeading');
const netPayHero      = document.getElementById('netPayHero');
const grossEarnings   = document.getElementById('grossEarnings');
const deductionsTotal = document.getElementById('deductionsTotal');
const netPaySummary   = document.getElementById('netPaySummary');
const basicRow        = document.getElementById('basicRow');
const hraRow          = document.getElementById('hraRow');
const allowancesRow   = document.getElementById('allowancesRow');
const deductionsRow   = document.getElementById('deductionsRow');
const netTotalRow     = document.getElementById('netTotalRow');
const netRatioPct     = document.getElementById('netRatioPct');
const netRatioInsight = document.getElementById('netRatioInsight');
const effectiveFrom   = document.getElementById('effectiveFrom');
const payrollStatus   = document.getElementById('payrollStatus');
const downloadBtn     = document.getElementById('downloadPayslip');
const loadingMsg      = document.getElementById('payrollLoading');
const errorMsg        = document.getElementById('payrollError');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(amount, currency = 'INR') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}
function setText(el, val) { if (el) el.textContent = val; }

// ─── Render my payroll ────────────────────────────────────────────────────────
let _payrollData = null;

function renderPayroll(p) {
  const cur   = p.currency || 'INR';
  const gross = (p.basic || 0) + (p.hra || 0) + (p.allowances || 0);
  const ded   = p.deductions || 0;
  const net   = p.netSalary ?? (gross - ded);
  const ratio = gross > 0 ? Math.round((net / gross) * 100) : 0;
  const eff   = p.effectiveFrom
    ? new Date(p.effectiveFrom).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : '—';

  setText(netPayHeading,  `${eff} • NET PAY`);
  setText(netPayHero,     fmt(net, cur));
  setText(grossEarnings,  fmt(gross, cur));
  setText(deductionsTotal, fmt(ded, cur));
  setText(netPaySummary,  fmt(net, cur));
  setText(basicRow,       fmt(p.basic, cur));
  setText(hraRow,         fmt(p.hra, cur));
  setText(allowancesRow,  fmt(p.allowances, cur));
  setText(deductionsRow,  '− ' + fmt(ded, cur));
  setText(netTotalRow,    fmt(net, cur));
  setText(netRatioPct,    ratio + '%');
  setText(netRatioInsight, `${ratio}% of your gross salary was credited after all deductions.`);
  setText(effectiveFrom,  eff);
  setText(payrollStatus,  'PAID');
  if (loadingMsg) loadingMsg.style.display = 'none';
}

async function loadPayroll() {
  if (loadingMsg) loadingMsg.style.display = 'block';
  if (errorMsg)   errorMsg.style.display   = 'none';
  try {
    const res = await api.getMyPayroll();
    _payrollData = res.data;
    renderPayroll(_payrollData);
  } catch (err) {
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (errorMsg) {
      errorMsg.textContent = err.status === 404
        ? 'No payroll structure set up yet. Contact your HR admin.'
        : 'Failed to load payroll. Please try again.';
      errorMsg.style.display = 'block';
    }
  }
}

// ─── Download payslip ─────────────────────────────────────────────────────────
downloadBtn?.addEventListener('click', () => {
  if (!_payrollData) { alert('Payroll data not loaded yet.'); return; }
  const p   = _payrollData;
  const cur = p.currency || 'INR';
  const gross = (p.basic || 0) + (p.hra || 0) + (p.allowances || 0);
  const eff = p.effectiveFrom
    ? new Date(p.effectiveFrom).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : '';
  const lines = [
    '════════════════════════════════════════',
    '       DAYFLOW HRMS — SALARY SLIP       ',
    '════════════════════════════════════════',
    `Employee ID   : ${p.employeeId}`,
    `Period        : ${eff}`,
    `Generated On  : ${new Date().toLocaleString('en-IN')}`,
    '────────────────────────────────────────',
    `Basic Salary  : ${fmt(p.basic, cur)}`,
    `HRA           : ${fmt(p.hra, cur)}`,
    `Allowances    : ${fmt(p.allowances, cur)}`,
    '────────────────────────────────────────',
    `Gross Earnings: ${fmt(gross, cur)}`,
    `Deductions    : - ${fmt(p.deductions, cur)}`,
    '════════════════════════════════════════',
    `NET SALARY    : ${fmt(p.netSalary, cur)}`,
    '════════════════════════════════════════',
    '',
    'This is a system-generated payslip.',
    'Dayflow HRMS — Every workday, perfectly aligned.',
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `payslip-${p.employeeId}-${eff.replace(/\s/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Admin: load another employee's payroll ───────────────────────────────────
const toast = document.getElementById('toast');
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

let _adminTargetEmpId = null;

document.getElementById('adminLoadPayrollBtn')?.addEventListener('click', async () => {
  const empId = document.getElementById('adminEmpIdInput')?.value.trim();
  if (!empId) { showToast('Enter an Employee ID.'); return; }

  try {
    const res = await apiFetch(`/payroll/${empId}`);
    _adminTargetEmpId = empId;
    const p   = res.data;
    const cur = p.currency || 'INR';

    document.getElementById('adminPayrollInfo').style.display  = 'block';
    document.getElementById('adminPayrollName').textContent = `📋 Payroll for: ${empId}  |  Net: ${fmt(p.netSalary, cur)}`;
    document.getElementById('adminBasic').value       = p.basic       || '';
    document.getElementById('adminHra').value         = p.hra         || '';
    document.getElementById('adminAllowances').value  = p.allowances  || '';
    document.getElementById('adminDeductions').value  = p.deductions  || '';
    document.getElementById('adminEffectiveFrom').value = p.effectiveFrom
      ? new Date(p.effectiveFrom).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    updateComputedNet();
  } catch (err) {
    if (err.status === 404) showToast(`No payroll found for ${empId}. You can create one below.`);
    else showToast('Error: ' + err.message);
    _adminTargetEmpId = empId;
    document.getElementById('adminPayrollInfo').style.display = 'block';
    document.getElementById('adminPayrollName').textContent = `📋 Creating payroll for: ${empId}`;
    document.getElementById('adminEffectiveFrom').value = new Date().toISOString().slice(0, 10);
  }
});

function updateComputedNet() {
  const basic      = Number(document.getElementById('adminBasic')?.value)      || 0;
  const hra        = Number(document.getElementById('adminHra')?.value)        || 0;
  const allowances = Number(document.getElementById('adminAllowances')?.value) || 0;
  const deductions = Number(document.getElementById('adminDeductions')?.value) || 0;
  const net        = basic + hra + allowances - deductions;
  const el         = document.getElementById('adminComputedNet');
  if (el) el.textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(net);
}

['adminBasic','adminHra','adminAllowances','adminDeductions'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateComputedNet);
});

document.getElementById('adminSavePayrollBtn')?.addEventListener('click', async () => {
  if (!_adminTargetEmpId) { showToast('Load an employee first.'); return; }
  const basic         = Number(document.getElementById('adminBasic')?.value)      || 0;
  const hra           = Number(document.getElementById('adminHra')?.value)        || 0;
  const allowances    = Number(document.getElementById('adminAllowances')?.value) || 0;
  const deductions    = Number(document.getElementById('adminDeductions')?.value) || 0;
  const effectiveFrom = document.getElementById('adminEffectiveFrom')?.value;
  if (!effectiveFrom) { showToast('Set an effective date.'); return; }
  if (basic <= 0)     { showToast('Basic salary must be greater than 0.'); return; }

  const btn = document.getElementById('adminSavePayrollBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiFetch(`/payroll/${_adminTargetEmpId}`, {
      method: 'PUT',
      body: JSON.stringify({ basic, hra, allowances, deductions, effectiveFrom }),
    });
    showToast(`✅ Salary structure updated for ${_adminTargetEmpId}.`);
    updateComputedNet();
  } catch (err) {
    showToast('Failed: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save Salary Structure';
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadPayroll();
initNotificationBell();
