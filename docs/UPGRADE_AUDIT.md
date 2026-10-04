# StayOps AI Upgrade Audit

## Original project findings

1. **Authentication contract mismatch:** the frontend stored `response.data.token`, while the tenant-aware backend returned `accessToken`, so a successful SaaS login could leave the browser without a usable access token.
2. **Role mismatch:** the frontend protected the operator area with `ADMIN`, while the newer backend used `OWNER`, `MANAGER`, `ACCOUNTANT`, `FRONTDESK`, and `RESIDENT`.
3. **Refresh flow problem:** the refresh endpoint required a valid access token, which defeats refresh once an access token expires.
4. **Legacy APIs were not tenant-scoped:** rooms, bookings, payments, residents and mess queries could address records without consistently enforcing `tenant_id`.
5. **Tenant platform exposure:** the original platform tenant endpoints were publicly reachable.
6. **Payment/schema mismatch:** payment submission allowed a missing booking even though the base schema required `booking_id`.
7. **Operational gap:** residents had no tracked maintenance/complaint workflow.
8. **AI gap:** there was no server-side AI assistant or graceful behavior when a Google/Gemini API key was absent or invalid.
9. **Frontend polish gap:** the dashboard was functional but mostly card/list based, with limited live operational guidance.

## What StayOps AI adds

- Atomic workspace + owner onboarding.
- Tenant-aware authentication and refresh sessions.
- Tenant filtering on the legacy API layer used by the existing React screens.
- Maintenance tickets with priority/status/assignment/resolution fields.
- AI Copilot backed by live tenant-scoped aggregates.
- Gemini integration through the backend only, using the current `x-goog-api-key` REST authentication pattern.
- Deterministic local fallback so operational questions still work without a cloud key.
- Command Center metrics for occupancy, payments, meals and maintenance.
- Global API rate limiting, configurable CORS and non-fatal database startup.
