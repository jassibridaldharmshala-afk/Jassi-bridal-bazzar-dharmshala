# Jassi General Store

A standalone Boutique — Sale & Rental commerce project generated for **Jassi General Store**. It has its own source tree and must use its own database, storage and service credentials. Master Configuration, Store Portfolio and project-generation tools are intentionally absent from this client project.
## Managed installation

This package has one unique, revocable installation identity. Open `client-installation.json`, copy its values into the **backend hosting environment**, and then permanently delete that file before committing or sharing the project. Never put `CLIENT_LICENSE_KEY` in the frontend. The admin **System & updates** screen shows subscription, limits, connection state and assigned updates without exposing that key.

## Start locally

1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Set a new MongoDB database URL and replace the JWT secrets.
5. If present, transfer `client-installation.json` values to the backend environment and delete the file.
6. Run `npm install` in this folder and in `backend`.
7. Run `npm run server` in one terminal and `npm start` in another.

## Phone app experience

The responsive storefront is also an installable Progressive Web App. It includes mobile navigation, product search and filters, product detail and sharing, bag, wishlist, address and payment checkout, orders and tracking, returns, profile, notifications, offline/update status, safe-area layout and home-screen shortcuts. The same backend remains the source of truth for identity, price, stock, coupons, payment and order state.

The default catalog uses **Boutique — Sale & Rental** with 15 product fields and 6 category definitions. Update branding, owner phone, payment, media, SMS and shipping credentials in the new installation before deployment. Website Designer remains available to the project admin and publishes a shared theme across desktop, mobile, loaders and admin. Configure email and WhatsApp alerts in Settings > Order alerts; the settings panel includes provider instructions, testing and delivery history. Each client supplies its own credentials; alerts start disabled.

## Security

No existing `.env` file, database record, upload, Git history, build output or dependency is copied from the source platform. The one-time installation credential is newly generated for this client and can be revoked independently. Production builds omit source maps, deployment headers restrict script sources and framing, private API responses are not cached, CORS accepts only configured origins, and sensitive actions are validated by the backend. Browser JavaScript is public by design, so never put secrets or authorization decisions in frontend code.

## Install the combined or separate project

The combined project contains the frontend at this root and its runtime backend in `backend/`.
The backend deployment source in `backend-deploy/` is also maintained for a separate Render backend service.
Run `npm ci` at the frontend root and inside the backend directory used by your deployment.
A frontend-only package needs the separate backend package alongside it; `npm run server` expects the combined `backend/` layout.

Set the frontend API URL to the actual backend service. Set backend public API URL and CORS origin to the actual deployment;
the Jassi frontend origin is `https://jassi-bridal-bazzar-dharmshalas.onrender.com` (including the final **s**).
Keep installation credentials, signing keys, SMS/payment/media credentials on the backend.
Production OTP defaults to real delivery; configure and test the actual SMS provider before accepting logins.
The source-root client installation identity is not imported into the browser build.

## Audit verification and evidence migration

Use `npm run test:client -- --runInBand` for applicable frontend suites.
`ClientInstallations.test.jsx` describes a platform-only page absent from this generated client; its source remains preserved.
Backend `npm test` uses isolated commerce fixtures; licence cache/signature tests retain their signed test responses.
These tests do not validate a live licence, SMS provider, payment capture, physical inventory or hosted storage.

Private sale/return/packing evidence now uses authenticated retrieval and GridFS instead of public catalogue media.
Existing public evidence needs a deployment migration. Run from the intended backend directory:

```text
npm run migrate:evidence -- --limit=100
npm run migrate:evidence -- --apply --limit=100
npm run migrate:evidence -- --apply --delete-public --limit=100
```

The first command is a dry run. Apply rewrites references transactionally and keeps a retryable purge journal.
Review the dry-run result, backup the database and confirm the target deployment before applying.
Public objects shared with catalogue/review media are retained and reported for manual classification.
After deleting old public objects, purge the relevant CDN cache; previously downloaded public files cannot be recalled.
Private photos allow 8 MB each; catalogue masters allow 20 MB each and 60 MB per upload batch.
Old downscaled photos need their originals re-uploaded; image processing cannot recreate lost detail.

See `review-notes/audit-fixes.md` for the code status and the live acceptance checks still requiring shop data and providers.
