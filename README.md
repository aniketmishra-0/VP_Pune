---
title: Vidyapeeth Pune
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# PW Vidyapeeth Pune — Student Performance Hub

High-performance student tracker, ranking matrices and role-based admin portal for Vidyapeeth Pune.

## Deploying on Hugging Face Spaces (Docker)

This Space runs a Node/Express server (port `7860`) that serves the built Vite SPA.

### Required Space Secrets (Settings → Variables and secrets)

| Name | Purpose |
|------|---------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full service-account JSON (for reading/writing the settings spreadsheet). |
| `SETTINGS_SPREADSHEET_ID` | ID of the Admin/Teacher/Staff settings spreadsheet. |
| `ADMIN_EMAILS` | Comma-separated super-admin emails (optional; a built-in default exists). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — real Google login. Without these, a mock login is used. |
| `APP_URL` | Optional — the public Space URL, used for OAuth callbacks. |

The settings spreadsheet must be shared (Editor) with the service-account email, and the
Google Sheets API must be enabled in that Google Cloud project.

## Run Locally

**Prerequisites:** Node.js 20+

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values you need.
3. `npm run dev`

## Build / Production

- `npm run build` — builds the client (Vite) and bundles the server (esbuild).
- `npm start` — runs the production server from `dist/`.
