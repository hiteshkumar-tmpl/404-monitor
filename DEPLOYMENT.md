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
┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │
│  GitHub        │      │  Email/Slack/   │
│  Actions       │      │  Teams Alerts   │
│  (Cron Jobs)   │      │                 │
└─────────────────┘      └─────────────────┘
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

## Step 3: Set Up GitHub Actions for Cron Jobs

1. **Add Secrets to GitHub Repository**
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `API_URL` - Your Railway API URL (e.g., `https://your-api.up.railway.app`)
     - `CRON_API_KEY` - A secret key you generate for cron authentication
     - `DATABASE_URL`
     - `JWT_SECRET`
     - `RESEND_API_KEY`
     - `EMAIL_FROM`
     - `APP_URL`

2. **Generate CRON_API_KEY**

   ```bash
   openssl rand -hex 32
   ```

   Use the output as your `CRON_API_KEY` secret

3. **Update Cron Schedule** (optional)
   - Edit `.github/workflows/cron.yml`
   - Change the cron expression for your desired frequency
   - Default is every 5 minutes

4. **Enable GitHub Actions**
   - The workflow will run automatically based on the schedule
   - You can also trigger manually from the Actions tab

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
| `CRON_API_KEY`   | Secret key for cron authentication    | `abc123...` (generate with `openssl rand -hex 32`)           |
| `RESEND_API_KEY` | Resend API key for email alerts       | `re_xxxxx`                                                   |
| `EMAIL_FROM`     | Sender email address                  | `alerts@yourdomain.com`                                      |
| `APP_URL`        | Frontend URL                          | `https://your-app.vercel.app`                                |
| `PORT`           | Server port ( Railway sets this)      | `3000`                                                       |

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

- Verify GitHub Actions is enabled
- Check Secrets are configured correctly
- Manual trigger to test

### Database connection issues

- Verify `DATABASE_URL` is correct
- Check Supabase allows connections from Railway IP
- In Supabase: Settings → Database → Allowed IPs → Set to `0.0.0.0/0` for development

### Email not sending

- Verify `RESEND_API_KEY` is valid
- Check `EMAIL_FROM` domain is verified in Resend
- Check Resend dashboard for delivery status
