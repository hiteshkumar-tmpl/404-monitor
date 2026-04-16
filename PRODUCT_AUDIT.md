# 404 Monitor Product Audit

## Product Snapshot
404 Monitor is a B2B website health tool focused on catching broken pages from XML sitemaps and notifying teams before SEO, campaign, or content issues spread. The product is already beyond MVP: it supports authenticated multi-user access, role-based admin controls, configurable monitoring intervals, multiple sitemap inputs per website, email/Slack/Teams alerts, and trend/history views. Today it feels strongest for small internal teams or agencies that need practical broken-link monitoring, but it is still early-stage from a product maturity standpoint because onboarding, investigation workflows, testing rigor, and launch-readiness are not yet at the same level as the core monitoring engine.

## Feature Inventory

### Authentication and User Management
- Login/logout with JWT cookies and protected routes.
- Current-user session loading and role-aware routing in the app.
- Forgot-password and reset-password flows.
- Admin-only user management: create, edit role/name, delete users.
- Admin dashboard stats across all users and websites.

### Website Onboarding
- Add property flow with property name, sitemap URL, alert email, and check interval.
- Initial sitemap parsing runs in the background after website creation.
- Per-website edit flow to change core settings later.
- Manual "Run Check Now" trigger from the website details screen.

### Sitemap Management
- Primary sitemap stored on the website record.
- Additional sitemap support per website.
- Refresh sitemap action to discover newly added URLs.
- Per-URL deletion and per-sitemap deletion controls.

### URL Monitoring
- Configurable check intervals per website, with a scheduler that evaluates due sites every minute.
- Batched URL checks with concurrency limits and stored status history.
- Detection of new 404s and recovered URLs.
- Website-level status summaries: pending, checking, ok, error.
- Dashboard summary across monitored properties.

### Alerting
- Email alerts for new broken URLs.
- Slack webhook alerts with realtime and summary-style behavior.
- Microsoft Teams webhook alerts with realtime and summary-style behavior.
- Configurable summary cadence including daily, multi-day, and custom intervals.
- Help pages for Slack and Teams setup.

### Analytics and History
- Dashboard trend API and UI trend chart.
- Per-website history endpoint and trends tab.
- Stored check history and URL status change history in the database.
- Summary-data endpoint for richer rollups like recently broken/fixed URLs and day-wise changes.

### Admin Controls
- Admin dashboard with total users, websites, URLs, and broken URLs.
- Admin can view all websites across users.
- Role separation between admin and standard users.

### Deployment and Ops
- Monorepo with shared DB schema, OpenAPI spec, generated API clients, and frontend/backend apps.
- Hybrid deployment guidance for Vercel + Railway + Supabase.
- Two scheduling patterns exist: in-app scheduler and GitHub Actions driven cron calls.
- Environment-driven alerting, auth, and cross-origin configuration.

## What’s Actually Implemented vs Partial

### Clearly Implemented and User-Facing
- Authenticated dashboard and property management.
- Admin user management.
- Manual and scheduled URL checking.
- Email, Slack, and Teams alert configuration in the UI.
- Multiple sitemap support.
- Basic dashboard and website-level trend visibility.
- Password reset and login recovery.

### Implemented in Backend but Only Partially Surfaced
- `summary-data` exposes richer status-change reporting than the current UI appears to use.
- URL status history captures newly broken and newly fixed states, but investigation UX is still fairly raw.
- Alert summary interval logic is powerful, but the user experience around choosing the right mode is still technical.
- Scheduler flexibility exists, but the product story still reads more like “hourly sitemap checker” than “configurable monitoring platform.”

### Scaffolding, Fragility, or Execution Gaps
- Typecheck currently fails in `lib/api-zod` because of a generated export collision around `GetWebsiteUrlsParams`.
- Automated test coverage is minimal to nonexistent; there are scripts, but not a real regression suite.
- Cron architecture is split between internal scheduler and GitHub Actions, which adds operational ambiguity.
- Generated API layers and docs are ahead of product polish in a few places, which can make the product look more complete on paper than in the UI.

## Strengths
- The product has a clear and narrow core value proposition: monitor sitemap URLs and alert quickly when breakage appears.
- The engineering model already supports multiple customer personas: solo operators, internal teams, and admins managing several users.
- Alerting breadth is unusually strong for this stage; Slack and Teams support materially improve team usefulness.
- The system stores historical data, which creates a credible path toward reporting, reliability scoring, and account expansion features.
- Configurable intervals and multi-sitemap support make the product more practical than a basic one-site/hourly-check tool.

## Gaps and Risks

### Product and UX
- There is no clear self-serve signup, invite flow, or trial path, which limits acquisition and product-led growth.
- Onboarding is functional but not guided; users need to understand sitemap structure, alert strategy, and webhook setup mostly on their own.
- Investigation UX is still shallow. Users can see broken URLs, but root-cause context, page ownership, severity ranking, and action suggestions are missing.
- Collaboration is narrow: there are users and alerts, but not teams, workspaces, notes, assignees, acknowledgment states, or routing by stakeholder.
- Alert configuration risks feeling technical rather than outcome-oriented, especially summary interval options and webhook setup.

### Reliability and Delivery
- The failing typecheck is a meaningful warning sign for roadmap velocity and release confidence.
- Missing automated tests make regressions likely in auth, generated API layers, and monitoring logic.
- Running both an internal scheduler and GitHub Actions cron creates unclear ownership of the monitoring job.
- Secrets and setup complexity are still high for a founder trying to launch or demo reliably.

### Security and Trust
- The repo documentation includes a seeded default admin account, which is risky if it survives beyond local development assumptions.
- Operational maturity is early: no clear audit logs, limited visible rate-limit/abuse protections, and little evidence of production-grade monitoring around the monitor itself.

### Go-to-Market
- The current positioning is useful but narrow: “404 monitor” is easy to understand, but also easy to perceive as a point tool.
- There is not yet a strong packaging story for agencies, SEO teams, content teams, or platform teams.

## Recommendations

### Quick Wins
- Fix the generated type/export issue and restore clean typecheck/build health.
- Choose one scheduling model as the default operating path and simplify deployment docs around it.
- Improve onboarding copy and empty states so a first-time user knows exactly what to add, what happens next, and what alert mode to choose.
- Make website details more action-oriented by highlighting newly broken URLs, newly fixed URLs, and last change time more clearly.
- Add basic product trust features: remove any dev-default credential language from public-facing docs, add better error states, and tighten setup validation for webhooks.

### Next 1-2 Roadmap Bets
- **Bet 1: Investigation Workflow**
  Build a triage experience around broken URLs: change feed, filters for newly broken vs existing, per-URL context, export/share, and action status. This increases retention because users get help resolving issues, not just detecting them.
- **Bet 2: Team Collaboration and Routing**
  Evolve from single alert targets to team-aware ownership: multiple recipients, channel routing rules, per-property stakeholders, acknowledgment states, and digest controls. This turns the product from a checker into an operations workflow.

### Longer-Term Feature Opportunities
- Expand from 404-only into broader site health coverage: 5xx spikes, redirect loops, noindex/canonical mismatches, robots.txt conflicts, sitemap freshness, and page-response latency.
- Add agency and multi-client packaging with workspace/account structures, portfolio dashboards, and branded reports.
- Introduce scheduled reports and executive summaries for founders, marketing leads, and SEO managers.
- Add benchmark or risk scoring so customers can prioritize the biggest SEO/business impact first.

## Proposed Feature Additions

| Feature | Problem Solved | Likely User | Expected Value | Priority |
| --- | --- | --- | --- | --- |
| Broken URL triage inbox | Users can detect issues but cannot manage response cleanly | SEO teams, content ops, marketing | Raises daily usefulness and retention | High |
| Multi-recipient alert routing | One email or webhook is too limiting for real teams | Growth teams, agencies, admins | Improves collaboration and adoption inside accounts | High |
| Guided onboarding wizard | First-run setup is too manual and technical | Solo marketers, SMB teams | Improves activation and reduces abandonment | High |
| Scheduled PDF/email reports | Historical data exists but is not packaged for stakeholders | Founders, managers, agencies | Creates reporting value and expansion potential | Medium |
| Workspace/team model | User-level roles are too basic for larger accounts | Agencies, larger orgs | Enables real multi-team selling | Medium |
| Expanded website health checks | 404 monitoring alone may feel narrow | SEO leads, platform teams | Improves differentiation and pricing power | Medium |
| Prioritized impact scoring | Large sites need help deciding what to fix first | Enterprise SEO, content ops | Makes alerts more actionable | Medium |
| Public status/API integrations | Teams may want to connect monitoring to broader workflows | Engineering and ops teams | Increases stickiness in mature organizations | Low |

## Scenario-Based Readout

### Solo Marketer
The product already covers the core need well: add a sitemap, receive alerts, and review broken pages. The biggest gaps are onboarding clarity, lighter setup friction, and more helpful alert explanations.

### Growth or SEO Team
This is the strongest near-term buyer. Slack/Teams support, trend visibility, and configurable intervals are already useful, but the product needs better routing, triage, and reporting to become a team system rather than a notification utility.

### Admin Managing Multiple Users
The admin surface is credible for an internal tool, but not yet for mature account management. It lacks team structures, invites, auditability, and governance controls.

### User Investigating a Broken URL
Detection is present; investigation is only partially solved. The next product lift should focus on turning “here is a broken URL” into “here is what changed, who should care, and what to do next.”

### Founder Positioning for SMB vs Larger Orgs
Today the best story is SMB/internal-team monitoring with room to grow into agencies and larger teams. To move upmarket, the product needs collaboration, reporting, trust, and operational polish more than entirely new monitoring logic.

### Engineer Extending the Product
The architecture is workable, but execution readiness is held back by broken type generation, very light automated testing, and deployment/scheduler complexity. Fixing these is important not just for engineering quality, but for roadmap speed.

## Bottom Line
404 Monitor is already a credible early-stage product with more real functionality than a typical MVP. The strongest next move is not a huge expansion in scope; it is to turn the existing monitoring engine into a cleaner activation, investigation, and team-collaboration experience while tightening engineering reliability. That path improves retention, sharpens positioning, and creates a better base for broader website health features later.
