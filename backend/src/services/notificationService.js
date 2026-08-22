const Notification = require('../models/Notification');

/**
 * Central place to create notifications. Other modules (leave, payroll,
 * attendance controllers) call this instead of writing to the Notification
 * model directly, so we can later fan this out to email/SMS/push channels
 * without touching business logic elsewhere.
 */
async function dispatch({ employeeId, type, title, body, meta = {} }) {
  const notification = await Notification.create({ employeeId, type, title, body, meta });

  // Placeholder for future channels, e.g.:
  // await emailChannel.send(employeeId, title, body);
  // await pushChannel.send(employeeId, title, body);

  return notification;
}

module.exports = { dispatch };
