/**
 * chatbot.js — Dayflow HR Assistant (preview / future enhancement)
 *
 * Provides scripted answers to 4 core HR questions.
 * Full AI integration (Google Gemini) is planned as a future enhancement.
 */

(function () {
  const toggleBtn  = document.getElementById('chatToggleBtn');
  const chatWindow = document.getElementById('chatWindow');
  const closeBtn   = document.getElementById('chatCloseBtn');
  const body       = document.getElementById('chatBody');
  const input      = document.getElementById('chatInput');
  const sendBtn    = document.getElementById('chatSendBtn');
  const presets    = document.getElementById('chatPresets');

  if (!toggleBtn) return; // not on a page that has the widget

  // ─── Open / close ───────────────────────────────────────────────────────────

  toggleBtn.addEventListener('click', () => {
    const open = chatWindow.classList.toggle('open');
    document.getElementById('chatBtnIcon').textContent = open ? '✕' : '✨';
    if (open) input.focus();
  });

  closeBtn.addEventListener('click', () => {
    chatWindow.classList.remove('open');
    document.getElementById('chatBtnIcon').textContent = '✨';
  });

  // ─── Knowledge base — 4 HR questions ────────────────────────────────────────

  const KB = [
    {
      keywords: ['leave', 'apply', 'request', 'time off', 'vacation', 'sick', 'paid'],
      answer: `
        <strong>Applying for Leave</strong><br><br>
        1. Go to <strong>Leave</strong> in the sidebar.<br>
        2. Select the leave type — Annual (Paid), Sick, or Personal (Unpaid).<br>
        3. Choose your start and end dates.<br>
        4. Add a reason and click <em>Submit Leave Request</em>.<br><br>
        Your request goes to your admin for approval. You'll get a notification once it's decided.
        <br><br>
        <span style="color:#9993c4;font-size:12px;">✨ Full AI-powered leave suggestions coming in a future release.</span>
      `,
    },
    {
      keywords: ['attendance', 'check in', 'checkin', 'check-in', 'check out', 'checkout', 'working hours', 'track', 'present'],
      answer: `
        <strong>Checking Your Attendance</strong><br><br>
        • Click <strong>Attendance</strong> in the sidebar to check in or out.<br>
        • The <em>Today's Timeline</em> tab shows your activity for the day.<br>
        • Switch to the <em>Weekly View</em> tab to see Mon–Sun records with hours worked.<br>
        • Your attendance progress bar tracks towards the 8-hour daily goal.<br><br>
        <span style="color:#9993c4;font-size:12px;">✨ Smart attendance analytics are planned as a future AI enhancement.</span>
      `,
    },
    {
      keywords: ['salary', 'payroll', 'pay', 'credited', 'payment', 'payslip', 'slip', 'net', 'deduction'],
      answer: `
        <strong>Salary & Payroll</strong><br><br>
        • Go to <strong>Payroll</strong> in the sidebar to view your latest salary breakdown.<br>
        • You'll see Basic, HRA, Allowances, Deductions, and Net Salary clearly listed.<br>
        • Use the <em>Download Payslip</em> button to save a text copy of your salary slip.<br><br>
        Salary is credited based on the effective date set by your HR admin. Contact HR if you notice any discrepancy.<br><br>
        <span style="color:#9993c4;font-size:12px;">✨ Automated payroll alerts via email are a planned future feature.</span>
      `,
    },
    {
      keywords: ['profile', 'update', 'edit', 'change', 'phone', 'address', 'picture', 'photo', 'personal'],
      answer: `
        <strong>Updating Your Profile</strong><br><br>
        • Click <strong>My Profile</strong> in the sidebar.<br>
        • You can update your <em>phone number</em> and <em>address</em> directly.<br>
        • To change your profile picture, use the picture section (upload is managed by HR).<br><br>
        Some fields like your name, designation, and department can only be edited by an HR admin.<br><br>
        <span style="color:#9993c4;font-size:12px;">✨ Self-service onboarding and document upload are coming in future releases.</span>
      `,
    },
  ];

  const FALLBACK = `
    I'm a <strong>preview demo</strong> — I can answer these core HR questions:<br><br>
    • How do I apply for leave?<br>
    • How can I check my attendance?<br>
    • When will my salary be credited?<br>
    • How do I update my profile?<br><br>
    <span style="color:#9993c4;font-size:12px;">
      ✨ Full natural language AI support (powered by Gemini) is planned as a future enhancement for Dayflow HRMS.
    </span>
  `;

  function findAnswer(text) {
    const lower = text.toLowerCase();
    for (const entry of KB) {
      if (entry.keywords.some(k => lower.includes(k))) {
        return entry.answer;
      }
    }
    return FALLBACK;
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────

  function addBubble(html, type) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${type}`;
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'chat-typing';
    t.id = 'chatTyping';
    t.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
  }

  function removeTyping() {
    document.getElementById('chatTyping')?.remove();
  }

  // ─── Send message ─────────────────────────────────────────────────────────────

  async function handleSend(text) {
    if (!text.trim()) return;

    // Hide presets after first interaction
    if (presets) presets.style.display = 'none';

    addBubble(text, 'user');
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    showTyping();

    // Simulate a short thinking delay for realism
    await new Promise(r => setTimeout(r, 750 + Math.random() * 500));

    removeTyping();
    addBubble(findAnswer(text), 'bot');

    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }

  // ─── Preset pills ─────────────────────────────────────────────────────────────

  document.querySelectorAll('.chat-preset').forEach(btn => {
    btn.addEventListener('click', () => handleSend(btn.dataset.q));
  });

  // ─── Input / send ─────────────────────────────────────────────────────────────

  sendBtn.addEventListener('click', () => handleSend(input.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input.value);
    }
  });

})();
