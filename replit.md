# 404 Monitor

## Overview

A full-stack web application that monitors website sitemaps and sends email alerts when pages start returning 404 errors.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (Tailwind CSS, shadcn/ui, wouter routing)
- **Email**: Resend API
- **Scheduler**: node-cron (hourly checks)
- **HTTP client**: Axios (with retry logic)
- **XML parsing**: xml2js

## Key Features

1. Add websites by providing a sitemap URL + alert email
2. Sitemap parser fetches and stores all `<loc>` URLs from sitemap.xml
3. Hourly cron job checks all URLs concurrently (5 at a time)
4. 404 detection: if URL was 200 → now 404, triggers email alert via Resend
5. Manual "Run Check Now" button per website
6. Dashboard with summary stats (total sites, URLs, broken URLs)
7. URL detail view with status filtering (All / Broken / OK)

## Project Structure

```
artifacts/
  api-server/        — Express backend API
    src/
      routes/        — API route handlers (websites.ts, health.ts)
      utils/         — sitemapParser.ts, urlChecker.ts, emailer.ts, checker.ts
      cron/          — scheduler.ts (hourly node-cron job)
  monitor-app/       — React + Vite frontend (served at /)
    src/
      pages/         — dashboard.tsx, add-website.tsx, website-details.tsx
      components/    — layout.tsx, shadcn UI components

lib/
  db/                — Drizzle ORM schema + connection (websites, monitored_urls tables)
  api-spec/          — OpenAPI spec (openapi.yaml) + Orval codegen config
  api-client-react/  — Generated React Query hooks (from codegen)
  api-zod/           — Generated Zod schemas (from codegen)
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables

- `RESEND_API_KEY` — Resend API key for sending email alerts
- `EMAIL_FROM` — From address for alert emails
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Session secret

## API Endpoints

- `GET /api/websites` — list all monitored websites
- `POST /api/websites` — add a website (name, sitemapUrl, alertEmail)
- `GET /api/websites/:id` — get website details
- `DELETE /api/websites/:id` — delete a website
- `GET /api/websites/:id/urls` — get all URLs (optional ?status=broken|ok|all)
- `POST /api/websites/:id/check` — manually trigger a check
- `GET /api/dashboard/summary` — summary stats
