const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Admin SDK; in Cloud Functions environment this will use the default service account
if (!admin.apps.length) {
  admin.initializeApp();
}

// HTTP function to send notifications. Prefer using Admin SDK (no server key required).
// Body options: { topic: 'topicName' } OR { token: 'deviceToken' }, plus { title, body, data }
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Use POST');
  const { topic, token, title = 'Mombasa Mall', body = '', data = {} } = req.body || {};

  try {
    if (topic) {
      const message = { notification: { title, body }, data, topic };
      const resp = await admin.messaging().send(message);
      return res.status(200).json({ success: true, result: resp });
    }
    if (token) {
      const message = { notification: { title, body }, data, token };
      const resp = await admin.messaging().send(message);
      return res.status(200).json({ success: true, result: resp });
    }
    return res.status(400).json({ error: 'Provide topic or token in the request body' });
  } catch (err) {
    // Fallback: if a legacy server key exists in functions config, use the legacy HTTP API
    const cfg = functions.config();
    const serverKey = cfg && cfg.fcm && cfg.fcm.server_key;
    if (serverKey) {
      try {
        const legacyPayload = token
          ? { to: token, notification: { title, body }, data }
          : { to: `/topics/${topic}`, notification: { title, body }, data };
        const r = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${serverKey}`
          },
          body: JSON.stringify(legacyPayload)
        });
        const json = await r.json();
        return res.status(200).json({ success: true, fallback: true, result: json });
      } catch (err2) {
        return res.status(500).json({ error: err.message, fallbackError: err2.message });
      }
    }

    return res.status(500).json({ error: err.message, hint: 'Initialize Admin with a service account or set functions config fcm.server_key' });
  }
});
