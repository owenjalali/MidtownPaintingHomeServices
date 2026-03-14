# Midtown Painting Home Services

## Local Setup

1. Install dependencies:
   `npm install`
2. Create `.env` from `.env.example` and fill in your SMTP + recipient values.
3. Run frontend + backend + Trigger worker (recommended for full Trigger orchestration + reminders):
   `npm run dev:full:trigger`
4. Open the site at:
   `http://localhost:5173`

If you only need frontend + API without Trigger task execution, use:
`npm run dev:full`

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
- `src/trigger/fieldLeadTasks.ts` field lead delayed SMS + reminder tasks

## Quote Form Backend

- Frontend submits quote form data to `POST /api/quote`.
- Backend endpoint lives in `server/index.mjs`.
- Images upload as multipart attachments under the `images` field.
- Successful submit sends an email with all form answers + uploaded image attachments.
- Quote dispatch defaults to direct SMTP in production (`QUOTE_DISPATCH_MODE=smtp-direct`) to avoid customer-facing dependency on Trigger worker health.
- In non-production, quote dispatch defaults to Trigger worker mode and falls back to direct SMTP when Trigger task execution errors.

## Calendar Booking Flow

- After form submit, frontend loads live availability from `GET /api/calendar/availability?month=YYYY-MM`.
- Availability is generated in 15-minute increments and filtered against Carter's real Google Calendar conflicts.
- Booking is finalized through `POST /api/calendar/booking`.
- Booking endpoint creates the calendar event, adds the client as an attendee, and sends confirmation emails to both Carter and the client.
- Client calendar invite emails are controlled by `BOOKING_GOOGLE_SEND_UPDATES` (`all`, `externalOnly`, or `none`).
- Booking confirmation emails include secure actor-specific manage links (`/manage-booking`) for client and Carter.
- Manage operations are available through:
  - `GET /api/calendar/manage/context`
  - `POST /api/calendar/manage/cancel`
  - `POST /api/calendar/manage/reschedule`
- Client self-service cancellation/reschedule is blocked inside the 12-hour cutoff, while Carter can override internally.
- Trigger reminder tasks are automatically scheduled as delayed runs for 60 minutes and 15 minutes before the booking (configurable).
- Reminder tasks send personalized reminders (including project details) to Carter and the client via email/SMS based on env flags.
- Reminder/notification tasks execute in Trigger.dev, so SMTP/Twilio vars must be configured in the Trigger.dev environment as well as the API host environment.
- If owner and client share the same phone number, reminder SMS sends are automatically deduplicated so one number only receives one SMS per reminder run.
- Legacy-event hardening script: run `npm run backfill:manage-links` (dry-run) to detect upcoming bookings missing manage-link tokens.

## Field Lead Flow

- Field flow now has two isolated namespaces: `FIELD_TEST_*` for local/Vercel Preview and `FIELD_*` for Vercel Production.
- Preview/local field flow is disabled unless `FIELD_TEST_ENABLED=true`. Production field flow is disabled unless both `FIELD_ENABLED=true` and `FIELD_ALLOW_PRODUCTION=true`.
- Rep intake lives at `/field/:accessKey` and loads rep options from `GET /api/field/config?accessKey=...`.
- Rep submit writes the lead to the active field lead log through `POST /api/field/leads`.
- The field intake captures rep, homeowner name, homeowner phone, address, and project notes.
- In preview/local only, a successful rep submit also returns a manual-test booking link immediately so operators can open the booking page without waiting for the delayed SMS. Production never exposes this link in the API response.
- A delayed Trigger task (`field-lead-send-initial-sms`) runs exactly 5 minutes later on the `field-lead-initial-sms` queue and texts the homeowner their booking link.
- A single delayed follow-up task (`field-lead-send-followup`) runs on the dedicated `field-lead-followups` queue only after the first SMS is actually sent. The schedule is anchored to `initialSmsSentAtIso`, not lead creation time.
- Customer booking lives at `/field-booking/:leadId?token=...` and books directly through `POST /api/field/leads/:leadId/booking`.
- Field booking and manage notifications use the active field-only owner, SMTP, Twilio, Google Calendar, and Sheets settings so the website booking flow stays isolated.
- Field lead storage can use either a local JSON file or a separate Google Sheet, controlled by `FIELD_TEST_STORE_MODE` in preview/local and `FIELD_STORE_MODE` in production.
- In Google Sheets mode, `FIELD[_TEST]_SHEETS_TAB_NAME` points at the hidden raw backing tab. Runtime also maintains a visible `${tabName} CRM` tab for operator use and rebuilds it from the raw rows after each write.
- Field booking writes directly to the active field calendar, updates the matching lead row to `booked`, sends the owner immediate email + SMS, sends the homeowner immediate confirmation SMS, schedules later field reminders on the `field-lead-reminders` queue, and syncs later reschedules/cancellations back into the field lead sheet.
- Public field booking/manage links prefer `FIELD_TEST_PUBLIC_BASE_URL` or `FIELD_PUBLIC_BASE_URL`, then fall back to `BOOKING_MANAGE_BASE_URL`, then `CORS_ORIGIN`.
- On the non-production field lane, create/booking requests prefer the incoming request host for generated links. This keeps Vercel Preview links pinned to the active deployment instead of an older preview URL left in env.
- Setting a Google Sheet row status to `closed_no_booking` immediately blocks future follow-ups and makes the public booking page return “This booking link is no longer available.”
- Setting a Google Sheet row status to `cancelled` keeps the row visible in the CRM while making the public booking page return a closed/cancelled state.
- Vercel Preview safety supports `FIELD_TEST_FORCE_OUTBOUND_ENABLED=true` to route all owner/customer field SMS and email to the configured test phone/email.
- Shared manage links still use `/manage-booking`; field leads are detected from calendar private metadata so customer manage notifications stay SMS-only while the internal owner notification pattern stays intact.
- For Google Sheets mode, use a dedicated Sheets service account through the field lane `SHEETS_*` vars. Do not reuse the website calendar credentials.

## Testing

- `npm run test:calendar` existing booking-window + manage-rule regression tests
- `npm run test:field` field lead API, env, Sheets, service, notification, and delayed-task tests
- `npm run test:smoke:field` live field-lane smoke test against a running preview/local stack (`/api/field/config` -> create lead -> preview booking link -> availability -> booking -> reschedule -> cancel)
  - supports protected Vercel Preview smoke runs when `FIELD_SMOKE_BASE_URL` points at the preview host and either `FIELD_SMOKE_VERCEL_SHARE_URL` or `FIELD_SMOKE_VERCEL_BYPASS_SECRET` is provided
- `npm run test:smoke:manage` books, loads manage links, reschedules, and cancels against the website booking lane; set `SMOKE_CUSTOMER_PHONE` and `SMOKE_CUSTOMER_EMAIL` first for controlled smoke recipients
- `npm run sync:vercel:field-preview-env` pushes the preview-safe `FIELD_TEST_*` allowlist plus Trigger dev wiring into the linked Vercel Preview environment using your local Vercel auth
- `npm run sync:vercel:field-prod-env` pushes the non-toggle production `FIELD_*` allowlist from `prod.env` into the linked Vercel Production environment
- `npm run sync:vercel:field-prod-activate` flips only `FIELD_ENABLED=true` and `FIELD_ALLOW_PRODUCTION=true` in Vercel Production
- `npm run deploy:trigger:prod` deploys the Trigger worker to the `prod` environment using `prod.env` as the local secret source
- Hosted Vercel Preview currently uses the Trigger dev key on purpose. Delayed field SMS/follow-up runs from Preview will stay queued unless a dev worker is connected, so keep `npm run dev:trigger:test` running during preview demos until a dedicated Trigger preview/staging environment exists.
- `npm run sync:field-crm` one-shot Google Sheets raw-tab migration + CRM rebuild for the active field lane
- `npm run reset:field-demo-crm` archives the current preview/local field raw rows into a hidden timestamped sheet, clears the active preview/local field sheet, and rebuilds an empty CRM tab for filming/demo resets. This command is blocked in production.
- `npm run build` frontend production build

## Preview Manual Test Flow

- Start the isolated field stack: `npm run dev:field:test:start`
- The startup script prints the rep intake URL, API health URL, and whether preview outbound override is enabled.
- Open the rep intake URL, capture a test lead, and use the success card's `Open booking link now` action to jump straight into the booking page.
- For safer preview QA, set `FIELD_TEST_FORCE_OUTBOUND_ENABLED=true` with `FIELD_TEST_FORCE_OUTBOUND_PHONE` and `FIELD_TEST_FORCE_OUTBOUND_EMAIL` so every field SMS/email stays routed to your test inbox/phone.
- After the stack is running, you can run `npm run test:smoke:field` to exercise the full field create/book/manage path against the preview lane without touching production credentials.

## Phase 3 Cutover

- Create an ignored `prod.env` from `.env.example` and fill the live website booking credentials, Trigger prod key, and the full production `FIELD_*` namespace. Keep `FIELD_ENABLED` and `FIELD_ALLOW_PRODUCTION` blank there; the activation command owns those flags.
- Phase 3 Step 1: ship the newer app code first, then confirm production `/api/health` exposes the field diagnostics while `fieldLeadConfigured=false` and `fieldLeadLocalOnly=false`.
- Phase 3 Step 1 validation: run `npm run test:smoke:manage` against production with explicit `SMOKE_BASE_URL`, `SMOKE_CUSTOMER_PHONE`, and `SMOKE_CUSTOMER_EMAIL` values so the live quote/calendar path is proven on the new deploy before the field lane is turned on.
- Phase 3 Step 2: run `npm run sync:vercel:field-prod-env`, then `npm run deploy:trigger:prod`, and verify Trigger prod now has the production `FIELD_*` namespace from the same release artifact.
- Final activation: run `npm run sync:vercel:field-prod-activate`, redeploy Vercel production, confirm `/api/health` turns all field checks green, and only then perform the controlled live field smoke.
- Rollback remains two-step: set either production field flag back to `false` and redeploy, or redeploy the prior Vercel production build if the application code itself regresses.

## Backend Environment Variables

- `PORT` API server port (default: `8787`)
- `CORS_ORIGIN` allowed frontend origin
- `MAX_UPLOAD_FILES` max image attachments per submit (default: `8`)
- `CALENDAR_AVAILABILITY_CACHE_TTL_MS` in-memory availability cache TTL in milliseconds (`0` disables cache, default: `120000`)
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
- `BOOKING_GOOGLE_SEND_UPDATES` Google Calendar attendee notification mode (`all`, `externalOnly`, or `none`; default: `none`)
- `BOOKING_SEND_REMINDER_EMAIL` global default email reminder toggle (`true`/`false`)
- `BOOKING_SEND_REMINDER_SMS` global default SMS reminder toggle (`true`/`false`)
- `BOOKING_REMINDER_1_MINUTES_BEFORE` first reminder offset (default: `60`)
- `BOOKING_REMINDER_1_SEND_EMAIL` first reminder email toggle
- `BOOKING_REMINDER_1_SEND_SMS` first reminder SMS toggle
- `BOOKING_REMINDER_2_MINUTES_BEFORE` second reminder offset (default: `15`)
- `BOOKING_REMINDER_2_SEND_EMAIL` second reminder email toggle (default: `false`)
- `BOOKING_REMINDER_2_SEND_SMS` second reminder SMS toggle (default: `true`)
- `BOOKING_REMINDER_3_MINUTES_BEFORE` third reminder offset (default: `5`)
- `BOOKING_REMINDER_3_SEND_EMAIL` third reminder email toggle (default: `false`)
- `BOOKING_REMINDER_3_SEND_SMS` third reminder SMS toggle (default: `false`)
- `BOOKING_REMINDER_RUN_TTL` optional override for delayed reminder run TTL. If unset, TTL is auto-sized per booking to avoid expiring before the reminder time.
- `BOOKING_NOTIFICATION_MACHINE` Trigger machine preset for reminder/notification tasks (default: `medium-1x`)
- `BOOKING_AVAILABILITY_QUEUE_CONCURRENCY` Trigger queue concurrency for interactive availability searches (default: `20`)
- `GOOGLE_CLIENT_ID` Google OAuth client id
- `GOOGLE_CLIENT_SECRET` Google OAuth client secret
- `GOOGLE_REFRESH_TOKEN` offline refresh token for the Google account with Carter's calendar access
- `GOOGLE_CALENDAR_ID` target calendar id/email for Carter
- `FIELD_ENABLED` enables the production field lane
- `FIELD_ALLOW_PRODUCTION` second production safety gate for the field lane
- `FIELD_INTAKE_SECRET` hidden production route token for `/field/:accessKey`
- `FIELD_REP_OPTIONS_JSON` production JSON array of rep options
- `FIELD_LINK_EXPIRY_DAYS` production booking-link expiry in days
- `FIELD_PUBLIC_BASE_URL` production public base URL used for field booking/manage links
- `FIELD_STORE_MODE` production field lead storage backend: `local-file` or `google-sheets`
- `FIELD_STORE_PATH` optional production local JSON store path for field leads
- `FIELD_SHEETS_SPREADSHEET_ID`
- `FIELD_SHEETS_TAB_NAME` raw backing tab name for Google Sheets mode; runtime also creates `${FIELD_SHEETS_TAB_NAME} CRM`
- `FIELD_SHEETS_CLIENT_EMAIL`
- `FIELD_SHEETS_PRIVATE_KEY`
- `FIELD_OWNER_EMAIL`
- `FIELD_OWNER_PHONE`
- `FIELD_SMTP_HOST`
- `FIELD_SMTP_PORT`
- `FIELD_SMTP_SECURE`
- `FIELD_SMTP_USER`
- `FIELD_SMTP_PASS`
- `FIELD_SMTP_FROM`
- `FIELD_TWILIO_ACCOUNT_SID`
- `FIELD_TWILIO_AUTH_TOKEN`
- `FIELD_TWILIO_FROM_NUMBER`
- `FIELD_GOOGLE_CLIENT_ID`
- `FIELD_GOOGLE_CLIENT_SECRET`
- `FIELD_GOOGLE_REFRESH_TOKEN`
- `FIELD_GOOGLE_CALENDAR_ID`
- `FIELD_FOLLOWUP_DELAY_MINUTES` production follow-up delay in minutes (default: `1440`)
- `FIELD_INITIAL_SMS_DELAY_SECONDS` optional production initial-text delay override in seconds (default: `300`)
- `FIELD_FOLLOWUP_DELAY_SECONDS` optional production follow-up delay override in seconds
- `FIELD_FOLLOWUP_1_DELAY_MINUTES` deprecated production fallback for the old first-follow-up env name
- `FIELD_TEST_ENABLED` enables the preview/local field lane
- `FIELD_TEST_INTAKE_SECRET` preview/local hidden route token for `/field/:accessKey` (`FIELD_INTAKE_SECRET` is still accepted as a non-production fallback)
- `FIELD_TEST_REP_OPTIONS_JSON` preview/local JSON array of rep options (`FIELD_REP_OPTIONS_JSON` is still accepted as a non-production fallback)
- `FIELD_TEST_LINK_EXPIRY_DAYS` preview/local booking-link expiry in days (`FIELD_LINK_EXPIRY_DAYS` is still accepted as a non-production fallback)
- `FIELD_TEST_PUBLIC_BASE_URL` preview/local public base URL used for field booking/manage links
- `FIELD_TEST_STORE_MODE` preview/local field lead storage backend: `local-file` or `google-sheets`
- `FIELD_TEST_STORE_PATH` preview/local local JSON store path for field leads
- `FIELD_TEST_SHEETS_SPREADSHEET_ID`
- `FIELD_TEST_SHEETS_TAB_NAME` raw backing tab name for Google Sheets mode; runtime also creates `${FIELD_TEST_SHEETS_TAB_NAME} CRM`
- `FIELD_TEST_SHEETS_CLIENT_EMAIL`
- `FIELD_TEST_SHEETS_PRIVATE_KEY`
- `FIELD_TEST_OWNER_EMAIL`
- `FIELD_TEST_OWNER_PHONE`
- `FIELD_TEST_SMTP_HOST`
- `FIELD_TEST_SMTP_PORT`
- `FIELD_TEST_SMTP_SECURE`
- `FIELD_TEST_SMTP_USER`
- `FIELD_TEST_SMTP_PASS`
- `FIELD_TEST_SMTP_FROM`
- `FIELD_TEST_TWILIO_ACCOUNT_SID`
- `FIELD_TEST_TWILIO_AUTH_TOKEN`
- `FIELD_TEST_TWILIO_FROM_NUMBER`
- `FIELD_TEST_GOOGLE_CLIENT_ID`
- `FIELD_TEST_GOOGLE_CLIENT_SECRET`
- `FIELD_TEST_GOOGLE_REFRESH_TOKEN`
- `FIELD_TEST_GOOGLE_CALENDAR_ID`
- `FIELD_TEST_INITIAL_SMS_DELAY_SECONDS` optional preview/local initial-text delay override in seconds (default: `300`)
- `FIELD_TEST_FOLLOWUP_DELAY_SECONDS` optional preview/local follow-up delay override in seconds
- `FIELD_TEST_FOLLOWUP_DELAY_MINUTES` preview/local follow-up delay in minutes (default: `10`)
- `FIELD_TEST_FOLLOWUP_1_DELAY_MINUTES` deprecated preview/local fallback for the old first-follow-up env name
- `FIELD_TEST_FORCE_OUTBOUND_ENABLED` reroutes all preview/local field SMS/email to the forced test recipients
- `FIELD_TEST_FORCE_OUTBOUND_PHONE` forced preview/local SMS destination for owner and customer field notifications
- `FIELD_TEST_FORCE_OUTBOUND_EMAIL` forced preview/local email destination for owner field notifications
- `SMOKE_CUSTOMER_PHONE` controlled recipient used by `npm run test:smoke:manage`
- `SMOKE_CUSTOMER_EMAIL` controlled recipient used by `npm run test:smoke:manage`
- `TWILIO_ACCOUNT_SID` required when SMS reminders are enabled
- `TWILIO_AUTH_TOKEN` required when SMS reminders are enabled
- `TWILIO_FROM_NUMBER` Twilio phone number used to send reminder texts
- `TRIGGER_SECRET_KEY` Trigger.dev API key used to trigger tasks from backend (`tr_dev_...` for local/dev, `tr_prod_...` for production)
- `TRIGGER_PROJECT_REF` Trigger.dev project reference
- `QUOTE_DISPATCH_MODE` quote submission dispatch mode: `smtp-direct` or `trigger` (default: `smtp-direct` in production, `trigger` otherwise)
