Firebase setup for Mombasa Mall

What was installed:
- firebase (web SDK) as a project dependency
- firebase-tools as a development dependency (CLI usable via npx)

Files added:
- firebase-config.js — ES module that initializes Firebase using the config provided.

Next interactive steps (requires signing in to Firebase):

1) Login with the Firebase CLI:
   npx firebase login

2) Initialize the project for features you want (hosting, firestore, storage, functions):
   npx firebase init
   - choose the project `mombasamall` when prompted (or select from your projects)
   - select services you want (Hosting, Firestore, Storage, Functions, etc.)
   - follow prompts to create firebase.json and .firebaserc

3) To emulate or serve locally:
   npx firebase emulators:start
   or for hosting previews:
   npx firebase serve --only hosting

4) Deploy to production (after building your site if necessary):
   npx firebase deploy --only hosting

Notes and caveats:
- Analytics requires HTTPS (or localhost) and a valid measurementId (present in the config).
- If you plan to use Firebase Auth, Firestore, Storage, or Cloud Functions, run `npx firebase init` and enable the corresponding features.
- The CLI can be used through npx, so global installation is not required. If you prefer global install:
   npm install -g firebase-tools

How to include the firebase-config module in the site (ES module approach):
- In an HTML page served as a module-capable environment, add:
  <script type="module">
    import { app, analytics } from './firebase-config.js';
    // use firebase app / analytics here
  </script>

If you want, the next step can be run here: run `npx firebase init` to create firebase.json and .firebaserc and set up hosting & other services. That step is interactive and requires you to authenticate; ask and it will be started when you are ready.