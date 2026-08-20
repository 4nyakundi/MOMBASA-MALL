Hosting (free tier) — quick start

This project is prepared to use Firebase Hosting on the Spark (free) plan. Cloud Functions were prepared separately but were not deployed because functions require Blaze billing.

To run and deploy hosting from your machine:

1) Login to Firebase CLI
   npx firebase login

2) (Optional) If this is the first time initializing the project locally, run init but you can skip since .firebaserc and firebase.json are present
   npx firebase init hosting
   - when prompted for public directory you can accept the default (.) which is already set in firebase.json

3) Preview locally
   npx firebase serve --only hosting
   or
   npx firebase emulators:start --only hosting

4) Deploy the website
   npx firebase deploy --only hosting --project mombasamall

Notes
- Hosting public is set to "." in firebase.json so the repository root is served; be careful not to expose sensitive files. If you prefer, change "public" to a dedicated directory like "public" and move site files there.
- Analytics is initialized in firebase-config.js and requires HTTPS or localhost.
- Cloud Functions were not deployed (requires Blaze). When ready to enable functions, upgrade billing and re-run the deploy for functions.
