import rateLimit from "express-rate-limit";
import { normalizeText } from "./fieldLeadCore.mjs";

const fieldConfigLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const fieldLeadMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const sendFieldLeadError = (res, error) => {
  const statusCode =
    error && typeof error === "object" && Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Unable to process your request right now. Please try again.";

  if (statusCode >= 500) {
    console.error("[field-lead] request failed", error);
  }

  res.status(statusCode).json({
    message:
      statusCode >= 500
        ? "Unable to process your request right now. Please try again."
        : message,
  });
};

const getPreferredHeaderValue = (req, headerName) =>
  normalizeText(req.get(headerName))
    .split(",")[0]
    .trim();

const getRequestPublicBaseUrl = (req) => {
  const protocol =
    getPreferredHeaderValue(req, "x-forwarded-proto") ||
    normalizeText(req.protocol) ||
    "http";
  const host =
    getPreferredHeaderValue(req, "x-forwarded-host") ||
    getPreferredHeaderValue(req, "host");

  if (!host) {
    return "";
  }

  return `${protocol}://${host}`;
};

export const registerFieldLeadRoutes = ({ app, service, hooks = {} }) => {
  app.get("/api/field/config", fieldConfigLimiter, async (req, res) => {
    try {
      const output = await service.getConfig({
        accessKey: normalizeText(req.query.accessKey),
      });
      res.status(200).json(output);
    } catch (error) {
      sendFieldLeadError(res, error);
    }
  });

  app.post("/api/field/leads", fieldLeadMutationLimiter, async (req, res) => {
    try {
      const output = await service.createLead({
        accessKey: normalizeText(req.body?.accessKey),
        repId: normalizeText(req.body?.repId),
        fullName: normalizeText(req.body?.fullName),
        phone: normalizeText(req.body?.phone),
        address: normalizeText(req.body?.address),
        projectNotes: normalizeText(req.body?.projectNotes),
        publicBaseUrl: getRequestPublicBaseUrl(req),
      });
      res.status(200).json(output);
    } catch (error) {
      sendFieldLeadError(res, error);
    }
  });

  app.get("/api/field/leads/:leadId/context", fieldConfigLimiter, async (req, res) => {
    try {
      const output = await service.getLeadContext({
        leadId: normalizeText(req.params.leadId),
        token: normalizeText(req.query.token),
      });
      res.status(200).json(output);
    } catch (error) {
      sendFieldLeadError(res, error);
    }
  });

  app.get("/api/field/leads/:leadId/availability", fieldConfigLimiter, async (req, res) => {
    try {
      const output = await service.getAvailability({
        leadId: normalizeText(req.params.leadId),
        token: normalizeText(req.query.token),
        month: normalizeText(req.query.month),
      });
      res.status(200).json(output);
    } catch (error) {
      sendFieldLeadError(res, error);
    }
  });

  app.post("/api/field/leads/:leadId/booking", fieldLeadMutationLimiter, async (req, res) => {
    const slotStartIso = normalizeText(req.body?.slotStartIso);
    let releaseSlotLock = null;

    try {
      if (slotStartIso && typeof hooks.acquireSlotLock === "function") {
        releaseSlotLock = hooks.acquireSlotLock(slotStartIso);
        if (!releaseSlotLock) {
          res.status(409).json({
            message:
              "That slot is being booked right now. Please wait a moment and pick another time if needed.",
          });
          return;
        }
      }

      if (typeof hooks.clearCalendarAvailabilityCache === "function") {
        hooks.clearCalendarAvailabilityCache();
      }

      const output = await service.bookLead({
        leadId: normalizeText(req.params.leadId),
        token: normalizeText(req.body?.token),
        slotStartIso,
        publicBaseUrl: getRequestPublicBaseUrl(req),
      });

      if (typeof hooks.clearCalendarAvailabilityCache === "function") {
        hooks.clearCalendarAvailabilityCache();
      }
      if (
        typeof hooks.clearManageContextCacheForEvent === "function" &&
        normalizeText(output?.booking?.eventId)
      ) {
        hooks.clearManageContextCacheForEvent(output.booking.eventId);
      }

      res.status(200).json(output);
    } catch (error) {
      sendFieldLeadError(res, error);
    } finally {
      if (typeof releaseSlotLock === "function") {
        releaseSlotLock();
      }
    }
  });
};
