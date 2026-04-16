# Deployment Guide - Hybrid Setup (Vercel + Railway)

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Vercel        │─────▶│  Railway        │─────▶│  Supabase       │
│  (Frontend)     │      │  (API Server)   │      │  (Database)     │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │
        │                        │
        ▼                        ▼
┌─────────────────┐
│                 │
│  Email/Slack/   │
│  Teams Alerts   │
│                 │
└─────────────────┘
```

## Step 1: Deploy API Server to Railway

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Deploy API Server**

   ```bash
   cd artifacts/api-server
   railway init
   railway up
   ```

3. **Set Environment Variables in Railway Dashboard**
   - `DATABASE_URL`: Your Supabase PostgreSQL connection string
   - `JWT_SECRET`: Generate a secure random string (min 32 chars)
   - `RESEND_API_KEY`: Your Resend API key for emails
   - `EMAIL_FROM`: Sender email (e.g., `alerts@yourdomain.com`)
   - `APP_URL`: Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)

4. **Get Railway API URL**
   - After deployment, you'll get a URL like: `https://your-api-server.up.railway.app`
   - Note this URL for the next step

## Step 2: Deploy Frontend to Vercel

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Import Project"
   - Select this GitHub repository
   - Set root directory to `artifacts/monitor-app`

3. **Configure Environment Variables in Vercel**

   ```
   VITE_API_URL=https://your-api-server.up.railway.app
   ```

   - Note: The frontend uses `VITE_` prefix for client-side env vars

4. **Update API Client Base URL**
   - The frontend expects the API at `/api/*`
   - Add a rewrite in `vercel.json` to proxy to your Railway app

5. **Deploy**
   - Click "Deploy"

## Step 3: Use the Built-In Scheduler

The API server already starts the monitoring scheduler on boot. It wakes up every
minute and checks each website only when its configured interval is due.

1. **Keep the API process running**
   - Railway should run a persistent web service for `artifacts/api-server`.
   - Do not rely on an external cron job for standard production use.

2. **Set the normal app secrets**
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `APP_URL`

3. **Optional fallback**
   - Keep `.github/workflows/cron.yml` only if your host may sleep or if you
     want an external recovery mechanism.
   - If you use that fallback, generate and provide `CRON_API_KEY`.

## Step 4: Update Vercel Rewrites

Update `artifacts/monitor-app/vercel.json` with your actual Railway URL:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-actual-api-server.up.railway.app/api/$1"
    }
  ]
}
```

## Environment Variables Reference

### Railway (API Server)

| Variable         | Description                           | Example                                                      |
| ---------------- | ------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`   | Supabase PostgreSQL connection string | `postgresql://postgres:...@db.xxx.supabase.co:5432/postgres` |
| `JWT_SECRET`     | Secret for JWT tokens (min 32 chars)  | `your-super-secret-key-at-least-32-chars`                    |
| `RESEND_API_KEY` | Resend API key for email alerts       | `re_xxxxx`                                                   |
| `EMAIL_FROM`     | Sender email address                  | `alerts@yourdomain.com`                                      |
| `APP_URL`        | Frontend URL                          | `https://your-app.vercel.app`                                |
| `PORT`           | Server port ( Railway sets this)      | `3000`                                                       |
| `ADMIN_SEED_EMAIL` | Optional first admin bootstrap email | `owner@yourdomain.com`                                       |
| `ADMIN_SEED_PASSWORD` | Optional first admin bootstrap password | `set-once-then-remove`                                  |

### Vercel (Frontend)

| Variable       | Description    | Example                           |
| -------------- | -------------- | --------------------------------- |
| `VITE_API_URL` | API server URL | `https://your-api.up.railway.app` |

## Custom Domain (Optional)

### Vercel

1. Go to project settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

### Railway

1. Go to project settings → Networking
2. Add custom domain
3. Configure DNS

## Troubleshooting

### Frontend can't reach API

- Check Vercel rewrites configuration
- Verify `VITE_API_URL` is set correctly
- Check browser console for CORS errors

### Cron jobs not running

- Verify the API service is running continuously
- Check the server logs for scheduler startup and due-check execution
- Use the GitHub Actions workflow only if you intentionally run the optional external fallback

### Database connection issues

- Verify `DATABASE_URL` is correct
- Check Supabase allows connections from Railway IP
- In Supabase: Settings → Database → Allowed IPs → Set to `0.0.0.0/0` for development

### Email not sending

- Verify `RESEND_API_KEY` is valid
- Check `EMAIL_FROM` domain is verified in Resend
- Check Resend dashboard for delivery status
