import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { runs, tasks } from "@trigger.dev/sdk";

const app = express();

const PORT = Number(process.env.PORT || 8787);
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_FILES = Number(process.env.MAX_UPLOAD_FILES || 8);
const TRIGGER_SAFE_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MONTH_QUERY_PATTERN = /^\d{4}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const REPEATING_DIGIT_PATTERN = /^(\d)\1{6,}$/;
const REPEATING_BLOCK_PATTERN = /^(\d{2,4})\1{2,}$/;
const REQUIRED_TRIGGER_ENV_VARS = ["TRIGGER_SECRET_KEY"];
const REQUIRED_SMTP_ENV_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "QUOTE_TO_EMAIL"];
const REQUIRED_GOOGLE_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_CALENDAR_ID",
];
const MISSING_TRIGGER_ENV_VARS = REQUIRED_TRIGGER_ENV_VARS.filter((key) => !process.env[key]);
const MISSING_SMTP_ENV_VARS = REQUIRED_SMTP_ENV_VARS.filter((key) => !process.env[key]);
const MISSING_GOOGLE_ENV_VARS = REQUIRED_GOOGLE_ENV_VARS.filter((key) => !process.env[key]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: MAX_UPLOAD_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("ONLY_IMAGE_FILES"));
  },
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value) => String(value ?? "").trim();
const normalizeDigits = (value) => normalizeText(value).replace(/\D/g, "");
const normalizeCountry = (country) => normalizeText(country).toUpperCase();

const normalizePostalCode = (postalCode, country) => {
  const compact = normalizeText(postalCode).toUpperCase().replace(/\s+/g, " ");
  if (normalizeCountry(country) === "CA") {
    const noSpaces = compact.replace(/\s+/g, "");
    if (noSpaces.length >= 6) {
      return `${noSpaces.slice(0, 3)} ${noSpaces.slice(3, 6)}`;
    }
  }

  return compact;
};

const isValidPostalCode = (postalCode, country) => {
  const normalizedCountry = normalizeCountry(country);
  if (normalizedCountry === "CA") {
    return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(postalCode);
  }

  if (normalizedCountry === "US") {
    return /^\d{5}(-\d{4})?$/.test(postalCode);
  }

  if (normalizedCountry === "UK") {
    return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(postalCode);
  }

  return postalCode.trim().length >= 3;
};

const isValidEmailAddress = (email) => {
  const normalizedEmail = normalizeText(email).toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return false;
  }

  if (normalizedEmail.includes("..")) {
    return false;
  }

  const [localPart = "", domainPart = ""] = normalizedEmail.split("@");
  if (!localPart || !domainPart) {
    return false;
  }

  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    domainPart.startsWith("-") ||
    domainPart.endsWith("-")
  ) {
    return false;
  }

  return true;
};

const normalizePhoneForTwilio = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const digits = normalizeDigits(raw);
  if (!digits) {
    return null;
  }

  if (REPEATING_DIGIT_PATTERN.test(digits) || REPEATING_BLOCK_PATTERN.test(digits)) {
    return null;
  }

  if (raw.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) {
      return null;
    }

    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
};

const normalizeLeadPayload = (input) => {
  const fullName = normalizeText(input.fullName);
  const email = normalizeText(input.email).toLowerCase();
  const addressLine1 = normalizeText(input.addressLine1);
  const city = normalizeText(input.city);
  const country = normalizeCountry(input.country);
  const provinceState = normalizeText(input.provinceState);
  const postalCode = normalizePostalCode(input.postalCode, country);
  const projectType = normalizeText(input.projectType);
  const projectDetails = normalizeText(input.projectDetails);
  const callGoal = normalizeText(input.callGoal);
  const budget = normalizeText(input.budget);
  const phoneCountryCode = normalizeText(input.phoneCountryCode);
  const phoneNationalNumber = normalizeDigits(input.phoneNationalNumber);
  const fallbackPhone = `${phoneCountryCode} ${phoneNationalNumber}`.trim();
  const phone = normalizePhoneForTwilio(normalizeText(input.phone) || fallbackPhone);

  return {
    fullName,
    phone,
    phoneCountryCode,
    phoneNationalNumber,
    email,
    addressLine1,
    city,
    postalCode,
    country,
    provinceState,
    projectType,
    projectDetails,
    budget,
    callGoal,
  };
};

const ensureTriggerConfigured = (res) => {
  if (MISSING_TRIGGER_ENV_VARS.length === 0) {
    return true;
  }

  res.status(500).json({
    message: `Server is missing required Trigger configuration: ${MISSING_TRIGGER_ENV_VARS.join(", ")}`,
  });
  return false;
};

const waitForRunOutput = async (handle, timeoutMs = 45000, pollIntervalMs = 700) => {
  let run = await runs.retrieve(handle);
  const runId = run.id;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (run.isSuccess) {
      return run.output;
    }

    if (run.isFailed || run.isCanceled) {
      const taskMessage =
        run.error && typeof run.error === "object" && "message" in run.error
          ? String(run.error.message)
          : `Task run ended with status ${run.status}`;
      throw new Error(taskMessage);
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for task run ${runId} to complete.`);
    }

    await wait(pollIntervalMs);
    run = await runs.retrieve(runId);
  }
};

const isManageTaskFailureOutput = (output) =>
  Boolean(
    output &&
      typeof output === "object" &&
      "ok" in output &&
      output.ok === false &&
      "statusCode" in output &&
      Number.isInteger(Number(output.statusCode))
  );

const mapTaskErrorToStatusCode = (message) => {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("invalid or expired")) {
    return 403;
  }

  if (normalized.includes("booking could not be found")) {
    return 404;
  }

  if (normalized.includes("already been canceled")) {
    return 409;
  }

  if (normalized.includes("self-service cutoff")) {
    return 403;
  }

  if (normalized.includes("cannot be updated right now")) {
    return 403;
  }

  if (
    normalized.includes("missing required booking details") ||
    normalized.includes("missing required manage details") ||
    normalized.includes("please provide a cancellation reason") ||
    normalized.includes("please provide a reschedule reason") ||
    normalized.includes("please choose a different time") ||
    normalized.includes("please select a new time slot") ||
    normalized.includes("valid email address") ||
    normalized.includes("outside carter's booking window") ||
    normalized.includes("already started") ||
    normalized.includes("at least") ||
    normalized.includes("invalid") ||
    normalized.includes("phone number") ||
    normalized.includes("postal code") ||
    normalized.includes("address") ||
    normalized.includes("month must be in yyyy-mm format")
  ) {
    return 400;
  }

  if (normalized.includes("just booked")) {
    return 409;
  }

  if (normalized.includes("timed out waiting for task run")) {
    return 504;
  }

  return 500;
};

if (process.env.CORS_ORIGIN) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
    })
  );
} else {
  app.use(cors());
}

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    triggerConfigured: MISSING_TRIGGER_ENV_VARS.length === 0,
    smtpConfigured: MISSING_SMTP_ENV_VARS.length === 0,
    googleCalendarConfigured: MISSING_GOOGLE_ENV_VARS.length === 0,
  });
});

app.post(
  "/api/quote",
  (req, res, next) => {
    upload.array("images", MAX_UPLOAD_FILES)(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }

      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!ensureTriggerConfigured(res)) {
        return;
      }

      const normalizedLead = normalizeLeadPayload(req.body ?? {});
      const {
        fullName,
        phone,
        phoneCountryCode,
        phoneNationalNumber,
        email,
        addressLine1,
        city,
        postalCode,
        country,
        provinceState,
        projectType,
        projectDetails,
        budget,
        callGoal,
      } = normalizedLead;

      if (
        !fullName ||
        !email ||
        !addressLine1 ||
        !city ||
        !postalCode ||
        !country ||
        !provinceState ||
        !projectType ||
        !projectDetails
      ) {
        res.status(400).json({
          message: "Please complete all required fields before submitting.",
        });
        return;
      }

      if (!isValidEmailAddress(email)) {
        res.status(400).json({
          message: "Please provide a valid email address.",
        });
        return;
      }

      if (!phone) {
        res.status(400).json({
          message: "Please provide a valid phone number in international format.",
        });
        return;
      }

      if (!isValidPostalCode(postalCode, country)) {
        res.status(400).json({
          message: "Please provide a valid postal code.",
        });
        return;
      }

      const files = Array.isArray(req.files) ? req.files : [];
      const estimatedEncodedImageBytes = files.reduce(
        (total, file) => total + Math.ceil((file.size || 0) * 1.37),
        0
      );

      if (estimatedEncodedImageBytes > TRIGGER_SAFE_PAYLOAD_BYTES) {
        res.status(413).json({
          message:
            "Uploaded images are too large for processing. Please upload fewer or smaller images (about 6MB total).",
        });
        return;
      }

      const images = files.map((file, index) => ({
        filename: (file.originalname || `image-${index + 1}`).replace(/[^\w.\-() ]+/g, "_"),
        contentType: file.mimetype,
        contentBase64: file.buffer.toString("base64"),
      }));

      const handle = await tasks.trigger("send-quote-email", {
        fullName,
        phone,
        phoneCountryCode,
        phoneNationalNumber,
        email,
        addressLine1,
        city,
        postalCode,
        country,
        provinceState,
        projectType,
        projectDetails,
        budget,
        callGoal,
        images,
        submittedAtIso: new Date().toISOString(),
      });

      await waitForRunOutput(handle);

      res.status(200).json({
        message: "Quote request sent successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/calendar/availability", async (req, res, next) => {
  try {
    if (!ensureTriggerConfigured(res)) {
      return;
    }

    const month = String(req.query.month || "").trim();
    if (!MONTH_QUERY_PATTERN.test(month)) {
      res.status(400).json({
        message: "Month must be in YYYY-MM format.",
      });
      return;
    }

    const handle = await tasks.trigger("calendar-get-availability", { month });
    const output = await waitForRunOutput(handle);

    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.post("/api/calendar/booking", async (req, res, next) => {
  try {
    if (!ensureTriggerConfigured(res)) {
      return;
    }

    const slotStartIso = normalizeText(req.body?.slotStartIso);
    const normalizedLead = normalizeLeadPayload(req.body ?? {});
    const {
      fullName,
      phone,
      phoneCountryCode,
      phoneNationalNumber,
      email,
      addressLine1,
      city,
      postalCode,
      country,
      provinceState,
      projectType,
      projectDetails,
      budget,
      callGoal,
    } = normalizedLead;

    if (
      !slotStartIso ||
      !fullName ||
      !email ||
      !addressLine1 ||
      !city ||
      !postalCode ||
      !country ||
      !provinceState ||
      !projectType ||
      !projectDetails
    ) {
      res.status(400).json({
        message: "Missing required booking details.",
      });
      return;
    }

    if (!isValidEmailAddress(email)) {
      res.status(400).json({
        message: "Please provide a valid email address.",
      });
      return;
    }

    if (!phone) {
      res.status(400).json({
        message: "Please provide a valid phone number in international format.",
      });
      return;
    }

    if (!isValidPostalCode(postalCode, country)) {
      res.status(400).json({
        message: "Please provide a valid postal code.",
      });
      return;
    }

    const handle = await tasks.trigger("calendar-book-slot", {
      slotStartIso,
      fullName,
      phone,
      phoneCountryCode,
      phoneNationalNumber,
      email,
      addressLine1,
      city,
      postalCode,
      country,
      provinceState,
      projectType,
      projectDetails,
      budget,
      callGoal,
    });

    const output = await waitForRunOutput(handle);
    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/manage/context", async (req, res, next) => {
  try {
    if (!ensureTriggerConfigured(res)) {
      return;
    }

    const eventId = normalizeText(req.query.eventId);
    const actor = normalizeText(req.query.actor).toLowerCase();
    const token = normalizeText(req.query.token);

    if (!eventId || !actor || !token) {
      res.status(400).json({
        message: "Missing required manage details.",
      });
      return;
    }

    const handle = await tasks.trigger("calendar-manage-context", {
      eventId,
      actor,
      token,
    });
    const output = await waitForRunOutput(handle);

    if (isManageTaskFailureOutput(output)) {
      res.status(Number(output.statusCode)).json({
        message: output.message,
      });
      return;
    }

    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.post("/api/calendar/manage/cancel", async (req, res, next) => {
  try {
    if (!ensureTriggerConfigured(res)) {
      return;
    }

    const eventId = normalizeText(req.body?.eventId);
    const actor = normalizeText(req.body?.actor).toLowerCase();
    const token = normalizeText(req.body?.token);
    const reason = normalizeText(req.body?.reason);

    if (!eventId || !actor || !token || !reason) {
      res.status(400).json({
        message: "Missing required manage details.",
      });
      return;
    }

    const handle = await tasks.trigger("calendar-manage-cancel", {
      eventId,
      actor,
      token,
      reason,
    });
    const output = await waitForRunOutput(handle);

    if (isManageTaskFailureOutput(output)) {
      res.status(Number(output.statusCode)).json({
        message: output.message,
      });
      return;
    }

    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.post("/api/calendar/manage/reschedule", async (req, res, next) => {
  try {
    if (!ensureTriggerConfigured(res)) {
      return;
    }

    const eventId = normalizeText(req.body?.eventId);
    const actor = normalizeText(req.body?.actor).toLowerCase();
    const token = normalizeText(req.body?.token);
    const reason = normalizeText(req.body?.reason);
    const newSlotStartIso = normalizeText(req.body?.newSlotStartIso);

    if (!eventId || !actor || !token || !reason || !newSlotStartIso) {
      res.status(400).json({
        message: "Missing required manage details.",
      });
      return;
    }

    const handle = await tasks.trigger("calendar-manage-reschedule", {
      eventId,
      actor,
      token,
      reason,
      newSlotStartIso,
    });
    const output = await waitForRunOutput(handle);

    if (isManageTaskFailureOutput(output)) {
      res.status(Number(output.statusCode)).json({
        message: output.message,
      });
      return;
    }

    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        message: "Each uploaded image must be 10MB or smaller.",
      });
      return;
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        message: `You can upload up to ${MAX_UPLOAD_FILES} images.`,
      });
      return;
    }

    res.status(400).json({
      message: "There was an issue with the uploaded files.",
    });
    return;
  }

  if (error instanceof Error && error.message === "ONLY_IMAGE_FILES") {
    res.status(400).json({
      message: "Only image files are allowed.",
    });
    return;
  }

  if (error instanceof Error) {
    const statusCode = mapTaskErrorToStatusCode(error.message);
    if (statusCode !== 500) {
      res.status(statusCode).json({
        message: error.message,
      });
      return;
    }
  }

  console.error("[server] Unexpected server error", error);
  res.status(500).json({
    message: "Unable to process your request right now. Please try again.",
  });
});

app.listen(PORT, async () => {
  console.log(`[server] Midtown backend listening on http://localhost:${PORT}`);

  if (MISSING_TRIGGER_ENV_VARS.length > 0) {
    console.warn(
      `[server] Missing env vars for Trigger task orchestration: ${MISSING_TRIGGER_ENV_VARS.join(", ")}`
    );
    return;
  }

  try {
    await runs.list({ limit: 1 });
    console.log("[server] Trigger.dev connection verified.");
  } catch (error) {
    console.error("[server] Trigger.dev verification failed:", error);
  }
});
