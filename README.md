# PantryBridge – Client Management Demo

A clickable demo of a client management system for **Sunrise Community Alliance** (a fictional nonprofit in metro Atlanta, Georgia). It covers monthly food distribution check-in, weekday pantry appointments, nonclinical program appointments, reports, and admin tools for 3 roles: **Administrator**, **Staff Member** and **Volunteer**.

Everything runs in the browser with realistic mock data. There is no backend, no login server, and no internet needed.

**▶ Live demo:** https://storage.googleapis.com/pantrybridge-demo-babuji/index.html

## Run the demo

The finished demo is already built: **`dist/index.html`** (one self-contained file, about 540 KB).

| How | What to do |
|---|---|
| **Offline (no install)** | Double-click `dist/index.html`, or `start-demo.bat` (Windows) / `start-demo.command` (Mac). |
| **Local server** | `npm install`, then `npm run demo` → opens http://localhost:4173 |
| **Share by USB / email** | Zip just `dist/index.html`. The recipient double-clicks it. |
| **Online** | Live at https://storage.googleapis.com/pantrybridge-demo-babuji/index.html (see Deploy below to update it). |

The same file works in all four cases.

**Start here:** on the login screen, click **"Open the 10-minute Demo Script"**. Each step has a **Go** button that switches to the right role and screen. Use **Reset demo data** before each presentation.

## What's in the demo

- **Volunteer:** big-button check-in, live counter, duplicate check-in block, Quick Register, 2-minute undo, read-only client search with limited fields.
- **Staff:** 3-step registration with live duplicate warning, client profiles (household, service history timeline, appointments, referrals), pantry day/week/list calendar with Completed / Canceled / Missed, program appointments with follow-ups and referrals, operational reports (print only).
- **Admin:** live KPI dashboard and charts, all 11 reports with date ranges, CSV / Excel / PDF / Print, user management, admin-editable form fields, programs & food categories, Excel/CSV import wizard (column mapping, duplicate merge), full data export, audit log, security settings (session timeout, MFA, backups).
- **Everywhere:** role switcher, guided tour, EN/ES language toggle, MFA screen for admins, inactivity sign-out warning, "no access" screen for restricted URLs, responsive layout down to 390px phones.

Demo changes are saved in the browser's localStorage, so they survive a page reload. **Reset demo data** restores the original sample.

## Develop

```bash
npm install
npm run dev      # rebuilds dist/index.html whenever a file in src/ changes (refresh the browser)
npm run build    # one-off production build
npm run demo     # build + open http://localhost:4173
```

Stack: React 19 + TypeScript, bundled by **esbuild** into a single inline HTML file (see `build.mjs`). Charts are hand-built SVG, and Excel import/export uses JSZip. Fonts fall back to the system font. There are no CDN calls of any kind.

Source layout:

```
src/
  data/seed.ts        mock data (deterministic, dates relative to today)
  lib/                store (localStorage), router (hash routes), metrics/reports, Excel/CSV, i18n
  components/         UI kit, charts, calendar, app shell, guided tour, logo (inline SVG)
  pages/              Login/MFA, Check-in, Dashboard, Clients, Distribution, Pantry, Appointments, Reports, Settings, Demo Script
  styles.css          design system (inlined at build time)
```

## Deploy (static hosting)

The app uses hash routes (`#/dashboard`) and relative paths, so it works from a bucket URL with no rewrite rules.

**AWS S3**
```bash
aws s3 mb s3://pantrybridge-demo --region us-east-1
aws s3 website s3://pantrybridge-demo --index-document index.html --error-document index.html
aws s3api put-public-access-block --bucket pantrybridge-demo --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket pantrybridge-demo --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::pantrybridge-demo/*"}]}'
aws s3 cp dist/index.html s3://pantrybridge-demo/index.html --cache-control "no-cache"
```
URL: `http://pantrybridge-demo.s3-website-us-east-1.amazonaws.com`

**Google Cloud Storage** (current live demo)

Bucket: `gs://pantrybridge-demo-babuji` · URL: https://storage.googleapis.com/pantrybridge-demo-babuji/index.html

To publish an update (PowerShell, after `npm run build`):
```powershell
gcloud storage cp dist\index.html gs://pantrybridge-demo-babuji/index.html --cache-control="no-cache"
```

First-time setup of a new bucket:
```bash
gcloud storage buckets create gs://pantrybridge-demo-babuji --location=us-east1 --uniform-bucket-level-access --no-public-access-prevention
gcloud storage buckets add-iam-policy-binding gs://pantrybridge-demo-babuji --member=allUsers --role=roles/storage.objectViewer
gcloud storage cp dist/index.html gs://pantrybridge-demo-babuji/index.html --cache-control="no-cache"
```
Always share the link ending in `/index.html`. Without a custom domain, Google Cloud serves files only by their full path.

> Bucket names are global. If `pantrybridge-demo` is taken, pick another name. The bucket is public, which is fine for fake demo data. **Never upload real client data to it.**

## Demo-only notes

- Login, MFA and roles are simulated in the browser. In the real system, permissions are enforced on the server.
- "Export PDF" opens the print dialog. Choose **Save as PDF**.
- All names, phone numbers and addresses are fictional.
