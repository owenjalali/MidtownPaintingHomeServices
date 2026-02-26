# MidtownPaintingHomeServices Agent Notes

This file is for AI coding agents working in this repository.

## Stack
- Frontend: Vite + React + TypeScript
- Backend: Express (`server/index.mjs`)
- Task orchestration: Trigger.dev (`src/trigger/*`)

## Local run commands
- Full end-to-end (required for quote/booking flows): `npm run dev:full:trigger`
- Frontend + API only: `npm run dev:full`
- Trigger worker only: `npm run dev:trigger`

## Testing commands
- Calendar tests: `npm run test:calendar`
- Manage-booking smoke script: `npm run test:smoke:manage`

## Important behavior
- Quote and booking routes wait on Trigger task runs.
- If Trigger worker is not running/connected, runs stay queued and requests fail.
- Use `/api/health` to quickly verify runtime config.

## Editing guidance
- Prefer minimal, targeted changes.
- Do not commit secrets from `.env`.
- Keep README and API behavior in sync when changing run commands or flow.
