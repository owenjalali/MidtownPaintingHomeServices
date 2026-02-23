export type BusyInterval = {
  startMs: number;
  endMs: number;
};

export const DEFAULT_DAY_START_MINUTES = 9 * 60;
export const DEFAULT_DAY_END_MINUTES = 21 * 60;
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const DEFAULT_DAY_START_CLOCK = "09:00";
const DEFAULT_DAY_END_CLOCK = "21:00";

export const parseClockToMinutes = (
  value: string | undefined,
  fallbackMinutes: number
) => {
  const [hourToken, minuteToken] = String(value || "").split(":");
  const hour = Number(hourToken);
  const minute = Number(minuteToken);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return fallbackMinutes;
  }

  return hour * 60 + minute;
};

export const parseWorkingDays = (value?: string) => {
  const parsed = new Set(
    (value || DEFAULT_WORKING_DAYS.join(","))
      .split(",")
      .map((token) => Number(token.trim()))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
  );

  if (parsed.size === 0) {
    return new Set<number>(DEFAULT_WORKING_DAYS);
  }

  return parsed;
};

export const normalizeBookingWindow = (options: {
  dayStart?: string;
  dayEnd?: string;
  workingDays?: string;
}) => {
  let dayStartMinutes = parseClockToMinutes(
    options.dayStart || DEFAULT_DAY_START_CLOCK,
    DEFAULT_DAY_START_MINUTES
  );
  let dayEndMinutes = parseClockToMinutes(
    options.dayEnd || DEFAULT_DAY_END_CLOCK,
    DEFAULT_DAY_END_MINUTES
  );

  if (dayEndMinutes <= dayStartMinutes) {
    dayStartMinutes = DEFAULT_DAY_START_MINUTES;
    dayEndMinutes = DEFAULT_DAY_END_MINUTES;
  }

  return {
    dayStartMinutes,
    dayEndMinutes,
    workingDays: parseWorkingDays(options.workingDays),
  };
};

export const isSlotWithinBookingWindow = (options: {
  weekday: number;
  slotStartMinutes: number;
  slotEndMinutes: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
  workingDays: Set<number>;
}) =>
  options.workingDays.has(options.weekday) &&
  options.slotStartMinutes >= options.dayStartMinutes &&
  options.slotEndMinutes <= options.dayEndMinutes;

export const slotOverlapsBusyInterval = (
  slotStartMs: number,
  slotEndMs: number,
  busyIntervals: BusyInterval[]
) => busyIntervals.some((busy) => slotStartMs < busy.endMs && slotEndMs > busy.startMs);
