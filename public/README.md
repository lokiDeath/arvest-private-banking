# Arvest Private Banking

A full-featured private banking web application with customer and admin dashboards.

## Features

### Customer Dashboard
- Multi-step login (Login ID → Password) with per-tab sessions
- Account overview (Checking, Savings, Private Client Reserve)
- Transaction history with filters, search, and CSV export
- Transfers (internal + external) — all pending admin approval
- Bill pay — all pending admin approval
- Card management (Arvest-issued + external cards with auto network detection)
- Statement generation (PDF download)
- Profile settings with picture upload and editable Login ID
- Address autocomplete (powered by Photon/OpenStreetMap)
- Notification bell with real-time updates
- 5-minute inactivity auto-logout

### Admin Dashboard
- Separate admin login (hardcoded credentials)
- Customer management (create, edit, delete, reset passwords)
- Full customer detail view with tabs:
  - Accounts (adjust balances)
  - Transactions (add, edit, delete, approve/flag/decline)
  - Cards (issue, freeze, close, view full details)
  - Profile (edit all fields)
- All customer transactions default to PENDING — admin must approve
- Analytics dashboard with charts
- Notification system (login alerts, transaction alerts, etc.)
- Audit log

### Security
- Per-tab session tokens (sessionStorage) — no cross-tab session sharing
- 5-minute inactivity auto-logout
- 3-attempt Login ID lockout with help options
- Admin credentials hardcoded in source (not in database)
- All passwords hashed with bcrypt

## Tech Stack
- Next.js 16 with App Router
- TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM
- Recharts (analytics)
- jsPDF (statement generation)
- Zustand (state management)

## Local Development

```bash
# Install dependencies
npm install

# Set up the database
npx prisma db push
npx prisma generate

# Seed the database with demo data
npx tsx scripts/seed.ts

# Start the dev server
npm run dev
```

Open http://localhost:3000

### Demo Credentials

**Admin:**
- Login ID: `LUCIAN1975`
- Password: `PASSWORD@@1975`

**Customers:**
- `alexandra.s7281` / `Sterling@2026`
- `james.w4920` / `Whitfield@2026`
- `maria.c8841` / `Castillo@2026`
- `robert.c2273` / `Chen@2026`

## Deploying to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Arvest Private Banking"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/arvest-private-banking.git
git push -u origin main
```

### 2. Set up a database
Vercel's serverless platform doesn't support SQLite files. Use a hosted PostgreSQL:

**Recommended: Supabase (free)**
1. Go to supabase.com → create a project
2. Settings → Database → copy the connection string

### 3. Switch to PostgreSQL

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run:
```bash
npx prisma db push
npx prisma generate
npx tsx scripts/seed.ts
```

### 4. Deploy on Vercel
1. Go to vercel.com → New Project → import your GitHub repo
2. Add Environment Variables:
   - `DATABASE_URL` = your PostgreSQL connection string
   - `SESSION_SECRET` = any random string
3. Deploy

### 5. Profile picture uploads
Vercel's filesystem is read-only. For profile picture uploads in production, use **Vercel Blob**:
```bash
npm install @vercel/blob
```
Update `src/app/api/profile/upload/route.ts` to use `put()` from `@vercel/blob` instead of `writeFile()`.

## Important Notes

- **Admin credentials** are hardcoded in `src/app/api/auth/login/route.ts` — change them before production
- **All customer transactions** (transfers + bill payments) are PENDING until the admin approves them
- **Per-tab sessions** mean logging in one tab doesn't log in other tabs
- **Address autocomplete** uses the free Photon API (no API key needed)

## License
This is a demo project for educational purposes.
