# Midtown Painting Home Services

## Local Setup

1. Install dependencies:
   `npm install`
2. Create `.env` from `.env.example` and fill in your SMTP + recipient values.
3. Run frontend + backend together:
   `npm run dev:full`
4. Open the site at:
   `http://localhost:5173`

## Trigger.dev Setup (Step-by-step)

1. Install dependencies (if not already done):
   `npm install`
2. Ensure `.env` has:
   - `TRIGGER_SECRET_KEY` (from Trigger dashboard > API Keys > DEV key)
   - `TRIGGER_PROJECT_REF` (project ref, starts with `proj_`)
3. Run Trigger local worker:
   `npm run dev:trigger`
4. Run everything together (frontend + API + Trigger):
   `npm run dev:full:trigger`

Included Trigger files:
- `trigger.config.ts` project config
- `src/trigger/helloWorld.ts` starter task
- `src/trigger/sendQuoteEmail.ts` email task scaffold

## Quote Form Backend

- Frontend submits quote form data to `POST /api/quote`.
- Backend endpoint lives in `server/index.mjs`.
- Images upload as multipart attachments under the `images` field.
- Successful submit sends an email with all form answers + uploaded image attachments.

## Calendar Booking Flow

- After form submit, frontend loads live availability from `GET /api/calendar/availability?month=YYYY-MM`.
- Availability is generated in 15-minute increments and filtered against Carter's real Google Calendar conflicts.
- Booking is finalized through `POST /api/calendar/booking`.
- Booking endpoint creates the calendar event, invites the client, and sends confirmation emails to both Carter and the client.
- Booking confirmation emails include secure actor-specific manage links (`/manage-booking`) for client and Carter.
- Manage operations are available through:
  - `GET /api/calendar/manage/context`
  - `POST /api/calendar/manage/cancel`
  - `POST /api/calendar/manage/reschedule`
- Client self-service cancellation/reschedule is blocked inside the 12-hour cutoff, while Carter can override internally.
- Trigger reminder tasks are automatically scheduled as delayed runs for 60 minutes and 15 minutes before the booking (configurable).
- Reminder tasks send personalized reminders (including project details) to Carter and the client via email/SMS based on env flags.
- If owner and client share the same phone number, reminder SMS sends are automatically deduplicated so one number only receives one SMS per reminder run.
- Legacy-event hardening script: run `npm run backfill:manage-links` (dry-run) to detect upcoming bookings missing manage-link tokens.

## Backend Environment Variables

- `PORT` API server port (default: `8787`)
- `CORS_ORIGIN` allowed frontend origin
- `MAX_UPLOAD_FILES` max image attachments per submit (default: `8`)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE` (`true` for SSL, typically with port `465`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `QUOTE_TO_EMAIL` destination inbox for quote submissions
- `BOOKING_OWNER_EMAIL` inbox for booking confirmations (defaults to `QUOTE_TO_EMAIL`)
- `BOOKING_OWNER_PHONE` Carter phone number for SMS reminders (`E.164` format, e.g. `+1647...`)
- `BOOKING_TIMEZONE` IANA timezone used for slot generation (default: `America/Toronto`)
- `BOOKING_DAY_START` start of booking window in `HH:mm` (default: `09:00`)
- `BOOKING_DAY_END` end of booking window in `HH:mm` (default: `21:00`)
- `BOOKING_WORKING_DAYS` comma-separated weekday numbers (`1=Mon ... 7=Sun`, default: `1,2,3,4,5,6,7`)
- `BOOKING_MIN_NOTICE_MINUTES` lead time required before booking (default: `120`)
- `BOOKING_DURATION_MINUTES` call duration in minutes (default: `15`)
- `BOOKING_SLOT_INTERVAL_MINUTES` slot spacing in minutes (default: `15`)
- `BOOKING_SELF_SERVICE_CUTOFF_MINUTES` client self-service lock window before the call (default: `720`)
- `BOOKING_MANAGE_BASE_URL` public site base URL used in manage links (default fallback: `CORS_ORIGIN` or `http://localhost:5173`)
- `BOOKING_SEND_REMINDER_EMAIL` global default email reminder toggle (`true`/`false`)
- `BOOKING_SEND_REMINDER_SMS` global default SMS reminder toggle (`true`/`false`)
- `BOOKING_REMINDER_1_MINUTES_BEFORE` first reminder offset (default: `60`)
- `BOOKING_REMINDER_1_SEND_EMAIL` first reminder email toggle
- `BOOKING_REMINDER_1_SEND_SMS` first reminder SMS toggle
- `BOOKING_REMINDER_2_MINUTES_BEFORE` second reminder offset (default: `15`)
- `BOOKING_REMINDER_2_SEND_EMAIL` second reminder email toggle (default: `false`)
- `BOOKING_REMINDER_2_SEND_SMS` second reminder SMS toggle (default: `true`)
- `BOOKING_REMINDER_RUN_TTL` queue TTL for delayed reminder runs (default: `24h`)
- `GOOGLE_CLIENT_ID` Google OAuth client id
- `GOOGLE_CLIENT_SECRET` Google OAuth client secret
- `GOOGLE_REFRESH_TOKEN` offline refresh token for the Google account with Carter's calendar access
- `GOOGLE_CALENDAR_ID` target calendar id/email for Carter
- `TWILIO_ACCOUNT_SID` required when SMS reminders are enabled
- `TWILIO_AUTH_TOKEN` required when SMS reminders are enabled
- `TWILIO_FROM_NUMBER` Twilio phone number used to send reminder texts
- `TRIGGER_SECRET_KEY` Trigger.dev API key used to trigger tasks from backend
- `TRIGGER_PROJECT_REF` Trigger.dev project reference
