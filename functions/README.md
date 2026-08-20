Cloud Functions for Mombasa Mall — Notifications

Overview
This folder contains an example Cloud Function that sends push notifications using the Firebase Admin SDK (recommended). A legacy HTTP fallback using a server key is included if you choose to provide one via functions config (not recommended for production).

Files
- index.js — example HTTPS function `sendNotification`.
- package.json — function dependencies (firebase-admin, firebase-functions, node-fetch).

Recommended flow (best practice)
1) Use Firebase Admin SDK inside Cloud Functions — it uses the function's service account and does not require exposing the FCM server key.
2) Deploy functions with `npx firebase deploy --only functions` after running `npx firebase init` and selecting Functions.

If you prefer to use the server key (legacy API)
Do NOT commit the server key. Set it in functions config:
  npx firebase functions:config:set fcm.server_key="YOUR_SERVER_KEY_HERE"

To read the config locally (for testing):
  npx firebase functions:config:get

Deploying
- Login: npx firebase login
- Initialize (one-time): npx firebase init functions (choose Node 18)
- Install dependencies inside functions/: cd functions && npm install
- Deploy: npx firebase deploy --only functions:sendNotification

Security notes
- Do not commit the server key or service account JSON to source control.
- Prefer the Admin SDK with an IAM service account or use Google Secret Manager to hold sensitive credentials.

If you want, I can:
- Run `npx firebase init` interactively and set up functions in this project (requires you to authenticate), or
- Run `npx firebase functions:config:set fcm.server_key="..."` here (I will not echo the value in repo files), or
- Create additional example functions (e.g., topic subscribe helper) — tell me which.