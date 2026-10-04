# StayOps AI — PG & Co-Living Operations Platform

StayOps AI is the upgraded, independently branded version of the original PG & Mess Management SaaS project. The existing room, bed, booking, resident, payment, mess, billing, Redis/BullMQ and analytics foundation is preserved and extended rather than rebuilt from scratch.

## What was upgraded

- **Tenant-safe authentication:** workspace-aware login, refresh-token flow, owner onboarding, RBAC compatibility and tenant-scoped legacy APIs.
- **AI Operations Copilot:** a server-side Gemini integration with a fast local workspace-tool fallback. The browser never receives the Gemini API key.
- **Maintenance & complaint desk:** ticket creation, categories, priorities, assignees, lifecycle statuses and resolution notes.
- **Command Center dashboard:** occupancy rate, revenue, pending payments, meal activity and service-health queues.
- **Interactive resident experience:** maintenance timelines, live refresh actions, AI suggestions and role-aware navigation.
- **Operational hardening:** global rate limiting, configurable CORS, non-fatal DB startup behavior, tenant-scoped reads/writes and safer payment/booking operations.

Current PG/hostel software products commonly emphasize live bed occupancy, rent/UPI tracking, complaints/maintenance, mess and resident self-service. StayOps combines those operational patterns with the project's existing multi-tenant SaaS architecture and an AI assistant. 

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TailwindCSS, Axios |
| Backend | Node.js, Express |
| Database | MySQL |
| Cache & jobs | Redis, BullMQ |
| Auth | JWT, tenant-aware RBAC, refresh sessions |
| AI | Google Gemini API + deterministic local fallback |
| Deployment | Vercel/frontend + your preferred Node host |

## Run locally

1. Create the database from `docs/database-schema.sql`.
2. Apply `docs/migrations/2026-02-20_saas_multitenant_upgrade.sql`.
3. Apply `docs/migrations/2026-09-30_stayops_upgrade.sql`. If upgrading an old database, backfill `tenant_id` on existing rooms/beds/bookings/residents/payments/mess rows before relying on tenant isolation.
4. Copy `backend/.env.example` to `backend/.env` and fill MySQL/JWT values. Add `GEMINI_API_KEY` when you want cloud AI.
5. Install and run the backend:

```bash
cd backend
npm ci
npm start
```

6. Install and run the frontend:

```bash
cd frontend
npm ci
npm run dev
```

## AI setup

Set `GEMINI_API_KEY` on the **backend only**. The server uses the Gemini REST `generateContent` endpoint and automatically falls back to workspace-tool answers when Gemini is missing or temporarily unavailable. This keeps core operational queries usable even with a bad/missing key.

## Resume-ready story

**StayOps AI — AI-Powered Multi-Tenant PG Operations Platform**

Built and upgraded a multi-tenant SaaS platform for PG/co-living operations by extending an existing room/booking/payment/mess stack with tenant-safe authentication, RBAC, maintenance workflows, live command-center analytics and an AI operations copilot. Implemented server-side Gemini integration with a deterministic fallback, tenant-scoped data access, refresh-token sessions, Redis/BullMQ job infrastructure and interactive React dashboards.
