# YUPOS — One Pos For Everything

Premium Universal POS Cashier built with React, TypeScript, Vite, Tailwind CSS, Firebase and XLSX.

## Included updates

- YUPOS blue / yellow / white visual system with premium POS styling.
- Browser title: `One Pos For Everything`.
- PWA manifest + service worker for install / Add to Home Screen.
- Installed application name: `YUPOS`.
- App icon uses the supplied YUPOS square logo.
- Entry splash screen uses the supplied horizontal YUPOS logo with animation.
- Browser speech synthesis attempts an English female-preferred voice for the splash phrase.
- Completed payments play a POS cash-register sound and announce the amount + payment method in Indonesian.
- Customer deletion with confirmation and Firebase/local persistence.
- Customer and Extract Data pages use responsive scrolling containers for phones, tablets, laptops and desktop.
- Password reset continues to use Firebase Authentication and surfaces a full-access purchase offer when Firebase returns `auth/user-not-found`.

## Run locally

Prerequisites: Node.js 20+

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Firebase security

The frontend Firebase Web API key is not a server credential. Keep Firebase Authentication, Firestore Security Rules, authorized domains and any server-side credentials secured in the Firebase project. Never commit Firebase service-account private keys to this repository.


## GitHub Pages

Do not deploy the repository source folder directly as a static site. GitHub Pages must serve the Vite production output from `dist/`. This repository includes `.github/workflows/deploy.yml`, which builds and deploys `dist/` automatically whenever `main` is pushed.

The Vite `base: './'` configuration makes assets resolve correctly when the repository is served under a GitHub Pages subpath.
