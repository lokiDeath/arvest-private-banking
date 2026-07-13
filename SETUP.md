# Arvest Private Banking — Setup & Deployment

## Part 1 — Run Locally

```bash
npm install
npm run db:push     # creates ./db/custom.db with all tables
npm run db:seed     # creates admin + Christopher + 2 years of transactions
npm run dev         # starts dev server on http://localhost:3000
```

### Login credentials
| Role | Login ID | Password |
|------|----------|----------|
| Admin | `LUCIAN1975` | `PASSWORD@@1975` |
| Customer | `christopher111` | `1975@1975` |

---

## Part 2 — Deploy to Vercel

Vercel does NOT support SQLite. You must switch to PostgreSQL first.

### Step 1 — Create a PostgreSQL database
Pick one (all free tiers work):
- **Neon** (recommended, easiest): https://neon.tech
- **Supabase**: https://supabase.com
- **Vercel Postgres**: https://vercel.com/docs/storage

Create a project, copy the connection string. It looks like:
```
postgresql://user:password@host/dbname?sslmode=require
```

### Step 2 — Change Prisma from SQLite to PostgreSQL

Open `prisma/schema.prisma` and change line 8:
```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 3 — Push the schema to your new Postgres database

On your local machine (temporarily set the env var):
```bash
# Mac/Linux
export DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
npm run db:push

# Windows PowerShell
$env:DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
npm run db:push
```

### Step 4 — Seed the Postgres database with users + transactions
```bash
# Make sure DATABASE_URL is still set to your Postgres URL from Step 3
npm run db:seed
```

You should see output like:
```
✅ Seed v5 completed. 250+ transactions created for Christopher.
   14 mobile deposits + 14 Zelle transfers added.
   Admin: LUCIAN1975 / PASSWORD@@1975
   Christopher: christopher111 / 1975@1975
```

### Step 5 — Push to GitHub
```bash
git init
git add .
git commit -m "Arvest Private Banking"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/arvest-private-banking.git
git push -u origin main
```

### Step 6 — Import to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. **Framework Preset**: Next.js (auto-detected)
4. **Build Command**: leave default (`prisma generate && next build`)
5. **Install Command**: leave default (`npm install`)

### Step 7 — Add environment variable in Vercel
In the Vercel project settings → **Environment Variables**, add:
- **Name**: `DATABASE_URL`
- **Value**: your PostgreSQL connection string (same as Step 3)
- **Environment**: Production, Preview, Development (check all three)

### Step 8 — Deploy
Click **Deploy**. Wait 2-3 minutes. Your app will be live at
`https://arvest-private-banking-xxx.vercel.app`.

Log in with the credentials above.

---

## What's Different From Your Previous Version

| Change | File | What was done |
|--------|------|---------------|
| Deposit nav icon | `customer-bottom-nav.tsx` | Smartphone → ScanLine (scanning icon) |
| Last nav tab | `customer-bottom-nav.tsx` | "More" → "Zelle" with Send icon |
| Money font | `globals.css` | Changed to Inter, weight 400 (not bold) |
| Bottom nav raised | `customer-bottom-nav.tsx` + `customer-dashboard.tsx` | Lifted 16px off bottom + extra safe-area padding, content padding `pb-24` → `pb-32` |
| Transfer separation | `customer-transfers.tsx` | Switching tabs now wipes shared fields so "Between my accounts" and "To someone else" never bleed into each other; added visible divider |
| Recent transfers | `customer-transfers.tsx` | Now includes Zelle transactions with purple icon, shows up to 8 |
| Deposit history | `scripts/seed.ts` | 14 mobile deposits from 2024 onwards (realistic memos, check numbers) |
| Zelle history | `scripts/seed.ts` | 14 Zelle transfers to 7 different recipients over 2 years |

---

## Troubleshooting

**"Server error" on login**
→ You haven't seeded the database. Run `npm run db:push` then `npm run db:seed`.

**"Cannot find module '@prisma/client'"**
→ Run `npm install` again. The `postinstall` script auto-generates the client.

**Build fails on Vercel with Prisma error**
→ Make sure `DATABASE_URL` env var is set in Vercel AND `prisma/schema.prisma` says `provider = "postgresql"`.

**App deploys but login still fails**
→ You forgot to run `npm run db:seed` against your Postgres database (Step 4). Run it locally with `DATABASE_URL` set to your Postgres URL.

**Port 3000 already in use**
→ `npm run dev -- -p 3001`
