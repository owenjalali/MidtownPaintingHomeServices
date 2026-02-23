import { DateTime } from "luxon";

export type ManageActor = "client" | "carter";

export type ManagePermissions = {
  canCancel: boolean;
  canReschedule: boolean;
  withinCutoff: boolean;
  reason: string | null;
};

type ManagePermissionOptions = {
  actor: ManageActor;
  eventStatus?: string | null;
  startIso?: string | null;
  endIso?: string | null;
  timezone: string;
  cutoffMinutes: number;
  now?: DateTime;
};

const DEFAULT_SELF_SERVICE_CUTOFF_MINUTES = 12 * 60;

export const normalizeManageActor = (value: string | null | undefined): ManageActor | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "client" || normalized === "carter") {
    return normalized;
  }

  return null;
};

export const normalizeManageReason = (reason: string | null | undefined) =>
  String(reason || "").replace(/\s+/g, " ").trim();

export const getManagePermissions = (options: ManagePermissionOptions): ManagePermissions => {
  const cutoffMinutes =
    Number.isFinite(options.cutoffMinutes) && options.cutoffMinutes >= 0
      ? Math.floor(options.cutoffMinutes)
      : DEFAULT_SELF_SERVICE_CUTOFF_MINUTES;
  const now = (options.now || DateTime.now()).setZone(options.timezone);
  const status = String(options.eventStatus || "").trim().toLowerCase();

  if (status === "cancelled") {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: false,
      reason: "This booking has already been canceled.",
    };
  }

  const start = DateTime.fromISO(String(options.startIso || ""), { setZone: true }).setZone(
    options.timezone
  );
  const end = DateTime.fromISO(String(options.endIso || ""), { setZone: true }).setZone(
    options.timezone
  );

  if (!start.isValid || !end.isValid || end <= start) {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: false,
      reason: "Booking details are invalid. Please contact Carter directly.",
    };
  }

  if (start <= now) {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: false,
      reason: "This booking has already started.",
    };
  }

  const withinCutoff = start <= now.plus({ minutes: cutoffMinutes });
  if (options.actor === "client" && withinCutoff) {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: true,
      reason:
        "Client updates are blocked inside the 12-hour self-service cutoff. Please contact Carter directly.",
    };
  }

  return {
    canCancel: true,
    canReschedule: true,
    withinCutoff,
    reason: null,
  };
};
