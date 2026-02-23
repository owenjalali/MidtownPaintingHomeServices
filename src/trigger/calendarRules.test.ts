import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_WORKING_DAYS,
  isSlotWithinBookingWindow,
  normalizeBookingWindow,
  parseWorkingDays,
  slotOverlapsBusyInterval,
  type BusyInterval,
} from "./calendarRules.ts";

const toSortedArray = (values: Set<number>) => [...values].sort((a, b) => a - b);

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

test("normalizeBookingWindow defaults to 9:00 AM through 9:00 PM for all 7 days", () => {
  const normalized = normalizeBookingWindow({});

  assert.equal(normalized.dayStartMinutes, DEFAULT_DAY_START_MINUTES);
  assert.equal(normalized.dayEndMinutes, DEFAULT_DAY_END_MINUTES);
  assert.deepEqual(toSortedArray(normalized.workingDays), [...DEFAULT_WORKING_DAYS]);
});

test("parseWorkingDays falls back to all seven days when env input is invalid", () => {
  const workingDays = parseWorkingDays("0,8,foo");
  assert.deepEqual(toSortedArray(workingDays), [...DEFAULT_WORKING_DAYS]);
});

test("normalizeBookingWindow resets to defaults when the configured window is invalid", () => {
  const normalized = normalizeBookingWindow({
    dayStart: "22:00",
    dayEnd: "08:00",
    workingDays: "1,3,5",
  });

  assert.equal(normalized.dayStartMinutes, DEFAULT_DAY_START_MINUTES);
  assert.equal(normalized.dayEndMinutes, DEFAULT_DAY_END_MINUTES);
  assert.deepEqual(toSortedArray(normalized.workingDays), [1, 3, 5]);
});

test("booking window accepts Monday-Sunday inside 9:00-21:00 and rejects outside times", () => {
  const allDays = new Set<number>(DEFAULT_WORKING_DAYS);

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    assert.equal(
      isSlotWithinBookingWindow({
        weekday,
        slotStartMinutes: 9 * 60,
        slotEndMinutes: 9 * 60 + 15,
        dayStartMinutes: DEFAULT_DAY_START_MINUTES,
        dayEndMinutes: DEFAULT_DAY_END_MINUTES,
        workingDays: allDays,
      }),
      true
    );
  }

  assert.equal(
    isSlotWithinBookingWindow({
      weekday: 2,
      slotStartMinutes: 8 * 60 + 45,
      slotEndMinutes: 9 * 60,
      dayStartMinutes: DEFAULT_DAY_START_MINUTES,
      dayEndMinutes: DEFAULT_DAY_END_MINUTES,
      workingDays: allDays,
    }),
    false
  );

  assert.equal(
    isSlotWithinBookingWindow({
      weekday: 4,
      slotStartMinutes: 20 * 60 + 55,
      slotEndMinutes: 21 * 60 + 10,
      dayStartMinutes: DEFAULT_DAY_START_MINUTES,
      dayEndMinutes: DEFAULT_DAY_END_MINUTES,
      workingDays: allDays,
    }),
    false
  );
});

test("slotOverlapsBusyInterval boundaries block only real overlaps", () => {
  const busyIntervals: BusyInterval[] = [{ startMs: 10 * 60_000, endMs: 20 * 60_000 }];

  assert.equal(slotOverlapsBusyInterval(0, 10 * 60_000, busyIntervals), false);
  assert.equal(slotOverlapsBusyInterval(20 * 60_000, 25 * 60_000, busyIntervals), false);
  assert.equal(slotOverlapsBusyInterval(10 * 60_000, 11 * 60_000, busyIntervals), true);
  assert.equal(slotOverlapsBusyInterval(19 * 60_000, 21 * 60_000, busyIntervals), true);
});

test("stress test: 20,000 randomized overlap checks match brute-force interval math", () => {
  const random = createSeededRandom(8675309);

  for (let i = 0; i < 20_000; i += 1) {
    const busyCount = Math.floor(random() * 8);
    const busyIntervals: BusyInterval[] = [];

    for (let j = 0; j < busyCount; j += 1) {
      const startMinute = Math.floor(random() * 1_440);
      const durationMinutes = Math.floor(random() * 240) + 1;
      busyIntervals.push({
        startMs: startMinute * 60_000,
        endMs: (startMinute + durationMinutes) * 60_000,
      });
    }

    const slotStartMinute = Math.floor(random() * 1_440);
    const slotDurationMinutes = (Math.floor(random() * 8) + 1) * 15;
    const slotStartMs = slotStartMinute * 60_000;
    const slotEndMs = (slotStartMinute + slotDurationMinutes) * 60_000;

    const expected = busyIntervals.some(
      (busy) => Math.max(slotStartMs, busy.startMs) < Math.min(slotEndMs, busy.endMs)
    );
    const actual = slotOverlapsBusyInterval(slotStartMs, slotEndMs, busyIntervals);

    assert.equal(actual, expected, `Mismatch on iteration ${i}`);
  }
});

test("offered slots skip busy events and keep adjacent openings", () => {
  const busyIntervals: BusyInterval[] = [
    {
      startMs: 10 * 60 * 60_000,
      endMs: (10 * 60 + 15) * 60_000,
    },
  ];
  const offeredSlots: number[] = [];
  const durationMs = 15 * 60_000;

  for (
    let slotStartMinutes = DEFAULT_DAY_START_MINUTES;
    slotStartMinutes + 15 <= DEFAULT_DAY_END_MINUTES;
    slotStartMinutes += 15
  ) {
    const slotStartMs = slotStartMinutes * 60_000;
    const slotEndMs = slotStartMs + durationMs;

    if (slotOverlapsBusyInterval(slotStartMs, slotEndMs, busyIntervals)) {
      continue;
    }

    offeredSlots.push(slotStartMinutes);
  }

  assert.equal(offeredSlots.includes(10 * 60), false);
  assert.equal(offeredSlots.includes(9 * 60 + 45), true);
  assert.equal(offeredSlots.includes(10 * 60 + 15), true);
});
