# SiteWatch

## Overview

A full-stack web application that monitors website sitemaps and sends email alerts when pages start returning 404 errors.

## Stack

- **Monorepo tool**: npm workspaces
- **Node.js version**: 24
- **Package manager**: npm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (Tailwind CSS, shadcn/ui, wouter routing)
- **Email**: Resend API
- **Scheduler**: node-cron (runs every minute and checks each site on its configured interval)
- **HTTP client**: Axios (with retry logic)
- **XML parsing**: xml2js
- **Auth**: JWT tokens via httpOnly cookies + bcryptjs password hashing

## Key Features

1. Add websites by providing a sitemap URL + alert email
2. Sitemap parser fetches and stores all `<loc>` URLs from sitemap.xml
3. Background scheduler checks each website on its configured interval and processes URLs concurrently (5 at a time)
4. 404 detection: if URL was 200 → now 404, triggers email alert via Resend
5. Manual "Run Check Now" button per website
6. Dashboard with summary stats (total sites, URLs, broken URLs)
7. URL detail view with status filtering (All / Broken / OK)
8. **User authentication** with login/logout
9. **Role-based access**: Admin and User roles
10. **Admin dashboard**: See all websites across all users
11. **User management**: Admin can create, edit, delete users

## Project Structure

```
artifacts/
  api-server/        — Express backend API
    src/
      routes/        — API route handlers (auth.ts, users.ts, websites.ts, health.ts)
      middleware/   — auth.ts (JWT middleware)
      utils/        — sitemapParser.ts, urlChecker.ts, emailer.ts, checker.ts, password.ts
      cron/          — scheduler.ts (per-site interval scheduler)
  monitor-app/       — React + Vite frontend (served at /)
    src/
      pages/         — dashboard.tsx, add-website.tsx, website-details.tsx, login.tsx
      pages/admin/   — admin/index.tsx, admin/users.tsx
      components/    — layout.tsx, shadcn UI components
      hooks/         — use-auth.ts (authentication context)

lib/
  db/                — Drizzle ORM schema + connection (users, websites, monitored_urls tables)
  api-spec/          — OpenAPI spec (openapi.yaml) + Orval codegen config
  api-client-react/  — Generated React Query hooks (from codegen)
  api-zod/           — Generated Zod schemas (from codegen)
```

## Key Commands

- `npm run typecheck` — full typecheck across all packages
- `npm run build` — typecheck + build all packages
- `npm run codegen -w @workspace/api-spec` — regenerate API hooks and Zod schemas from OpenAPI spec
- `npm run push -w @workspace/db` — push DB schema changes (dev only)
- `npm run dev -w @workspace/api-server` — run API server locally

## Environment Variables

- `RESEND_API_KEY` — Resend API key for sending email alerts
- `EMAIL_FROM` — From address for alert emails
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `JWT_SECRET` — Secret key for JWT tokens (min 32 characters)
- `JWT_EXPIRY` — JWT token expiry (default: 24h)
- `PORT` — Server port (required)

## Admin Bootstrap

If you want to seed the first admin user in a non-local environment, provide:

- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `ADMIN_SEED_NAME` (optional, defaults to `Admin`)

## Authentication

All API endpoints (except `/api/healthz` and `/api/auth/login`) require authentication via JWT cookie.

### Auth Endpoints

- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/logout` — Logout and clear cookie
- `GET /api/auth/me` — Get current authenticated user
- `PATCH /api/auth/password` — Change own password

### User Management (Admin Only)

- `GET /api/users` — List all users
- `POST /api/users` — Create new user
- `PATCH /api/users/:id` — Update user
- `DELETE /api/users/:id` — Delete user
- `GET /api/users/stats` — Get admin dashboard stats

## API Endpoints

### Websites (Authenticated)

- `GET /api/websites` — list monitored websites (scoped to current user, admin sees all)
- `POST /api/websites` — add a website (name, sitemapUrl, alertEmail)
- `GET /api/websites/:id` — get website details
- `DELETE /api/websites/:id` — delete a website
- `PATCH /api/websites/:id/update` — update website
- `GET /api/websites/:id/urls` — get all URLs (optional ?status=broken|ok|all)
- `GET /api/websites/:id/sitemaps` — list sitemaps
- `POST /api/websites/:id/sitemaps` — add sitemap
- `DELETE /api/websites/:id/sitemaps/:sitemapId` — delete sitemap
- `POST /api/websites/:id/check` — manually trigger a check
- `GET /api/dashboard/summary` — summary stats (scoped to user)
