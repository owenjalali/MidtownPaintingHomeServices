import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
} from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import type {
  FieldLeadBookingResponse,
  FieldLeadContextResponse,
} from "../lib/fieldLead";

type CalendarSlot = {
  startIso: string;
  endIso: string;
  label: string;
};

type AvailabilityResponse = {
  availabilityByDate: Record<string, CalendarSlot[]>;
  availableDates: string[];
  month: string;
  timezone: string;
  message?: string;
};

const WEEKDAY_LABELS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const fetchWithTimeout = (url: string, opts?: RequestInit, timeoutMs = 45000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => window.clearTimeout(timeoutId));
};

const toMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getMonthParam = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const getDateKey = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const FieldLeadBooking = () => {
  const { leadId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();

  const [context, setContext] = useState<FieldLeadContextResponse | null>(null);
  const [contextError, setContextError] = useState("");
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(() => toMonthStart(new Date()));
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, CalendarSlot[]>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState<FieldLeadBookingResponse | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      if (!leadId.trim() || !token) {
        setContextError("This booking link is missing required details.");
        setIsLoadingContext(false);
        return;
      }

      setIsLoadingContext(true);
      setContextError("");

      try {
        const params = new URLSearchParams({ token });
        const response = await fetchWithTimeout(`/api/field/leads/${leadId}/context?${params.toString()}`);
        const responseBody: FieldLeadContextResponse | { message?: string } = await response
          .json()
          .catch(() => ({}));
        if (!response.ok) {
          throw new Error(responseBody.message || "Unable to load this booking link.");
        }

        const nextContext = responseBody as FieldLeadContextResponse;
        setContext(nextContext);

        if (nextContext.booking?.slotStartIso) {
          const bookedDate = new Date(nextContext.booking.slotStartIso);
          if (!Number.isNaN(bookedDate.getTime())) {
            setCurrentMonth(toMonthStart(bookedDate));
          }
        }
      } catch (error) {
        setContext(null);
        setContextError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Unable to load this booking link."
        );
      } finally {
        setIsLoadingContext(false);
      }
    };

    void loadContext();
  }, [leadId, token, bookingSuccess]);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!context || context.state !== "open") {
        return;
      }

      setAvailabilityError("");
      setIsLoadingAvailability(true);

      try {
        const month = getMonthParam(currentMonth);
        const params = new URLSearchParams({
          token,
          month,
        });
        const response = await fetchWithTimeout(
          `/api/field/leads/${leadId}/availability?${params.toString()}`
        );
        const responseBody: AvailabilityResponse | { message?: string } = await response
          .json()
          .catch(() => ({
            availabilityByDate: {},
            availableDates: [],
            month,
            timezone: "America/Toronto",
          }));

        if (!response.ok) {
          throw new Error(responseBody.message || "Unable to load availability.");
        }

        const availability = responseBody as AvailabilityResponse;
        setAvailabilityByDate(availability.availabilityByDate || {});
        setAvailableDates(availability.availableDates || []);

        const nextSelectedDate =
          selectedDate && (availability.availabilityByDate[selectedDate] || []).length > 0
            ? selectedDate
            : availability.availableDates?.[0] || "";
        setSelectedDate(nextSelectedDate);
        setSelectedTime((availability.availabilityByDate[nextSelectedDate] || [])[0]?.startIso || "");
      } catch (error) {
        setAvailabilityByDate({});
        setAvailableDates([]);
        setSelectedDate("");
        setSelectedTime("");
        setAvailabilityError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Unable to load availability."
        );
      } finally {
        setIsLoadingAvailability(false);
      }
    };

    void loadAvailability();
  }, [context, currentMonth, selectedDate, leadId, token]);

  const selectedSlots = useMemo(
    () => (selectedDate ? availabilityByDate[selectedDate] || [] : []),
    [availabilityByDate, selectedDate]
  );

  const monthLabel = useMemo(
    () =>
      currentMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [currentMonth]
  );

  const todayMonth = useMemo(() => toMonthStart(new Date()), []);
  const canGoToPreviousMonth = useMemo(
    () =>
      currentMonth.getFullYear() > todayMonth.getFullYear() ||
      (currentMonth.getFullYear() === todayMonth.getFullYear() &&
        currentMonth.getMonth() > todayMonth.getMonth()),
    [currentMonth, todayMonth]
  );

  const firstDayOffset = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay();
  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const calendarCells = useMemo(() => {
    const cells: Array<{
      key: string;
      dayNumber: number | null;
      dateKey: string | null;
      hasAvailability: boolean;
    }> = [];

    for (let emptyIndex = 0; emptyIndex < firstDayOffset; emptyIndex += 1) {
      cells.push({
        key: `empty-${emptyIndex}`,
        dayNumber: null,
        dateKey: null,
        hasAvailability: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = getDateKey(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const daySlots = availabilityByDate[dateKey] || [];
      cells.push({
        key: dateKey,
        dayNumber: day,
        dateKey,
        hasAvailability: daySlots.length > 0,
      });
    }

    return cells;
  }, [availabilityByDate, currentMonth, daysInMonth, firstDayOffset]);

  const handleBook = async () => {
    if (!selectedTime || isBooking || !leadId || !token) {
      return;
    }

    setBookingError("");
    setIsBooking(true);

    try {
      const response = await fetchWithTimeout(`/api/field/leads/${leadId}/booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          slotStartIso: selectedTime,
        }),
      });
      const responseBody: FieldLeadBookingResponse | { message?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseBody.message || "Unable to book this slot right now.");
      }

      setBookingSuccess(responseBody as FieldLeadBookingResponse);
    } catch (error) {
      setBookingError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Unable to book this slot right now."
      );
    } finally {
      setIsBooking(false);
    }
  };

  const contextLead = context?.lead;
  const bookedState = bookingSuccess || (context?.state === "booked" ? context : null);
  const displayManageLink =
    bookingSuccess?.booking.manageLinks.client || context?.booking?.clientManageLink || "";

  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#f4efe6_0%,#ede2d2_45%,#e5d2b6_100%)] px-4 py-8 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[2rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_30px_80px_rgba(73,54,30,0.14)] backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Midtown Painting
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
            Book your 15-minute call with Carter
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            Choose the best time below. Once booked, you’ll get your manage link by text and can use
            the same self-service booking page for changes.
          </p>
        </div>

        {isLoadingContext && (
          <div className="flex items-center gap-2 rounded-2xl border border-stone-900/10 bg-white/80 px-4 py-3 text-sm text-stone-600">
            <Loader2 size={16} className="animate-spin" />
            Loading your booking link...
          </div>
        )}

        {!isLoadingContext && contextError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{contextError}</span>
            </div>
          </div>
        )}

        {!isLoadingContext && !contextError && contextLead && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-stone-900/10 bg-white/85 p-6 shadow-sm sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Lead Context
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-stone-950">{contextLead.customerName}</h2>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-amber-700" />
                    Link expires {new Date(contextLead.bookingExpiresAtIso).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-amber-700" />
                    Captured by {contextLead.repName}
                  </div>
                  {contextLead.customerAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 text-amber-700" />
                      <span>{contextLead.customerAddress}</span>
                    </div>
                  )}
                </div>
                <div className="mt-5 rounded-2xl bg-stone-100 px-4 py-4 text-sm leading-6 text-stone-700">
                  {contextLead.projectNotes}
                </div>
              </div>

              {bookedState && (
                <div className="rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm text-emerald-900 sm:p-8">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Your call is booked.</p>
                      <p className="mt-1">
                        {(bookingSuccess?.booking.displayDate || context.booking?.displayDate) ?? ""},{" "}
                        {(bookingSuccess?.booking.displayTime || context.booking?.displayTime) ?? ""}
                      </p>
                      {displayManageLink && (
                        <a
                          href={displayManageLink}
                          className="mt-3 inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                        >
                          Manage booking
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {context.state === "expired" && (
                <div className="rounded-[2rem] border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-900">
                  This booking link has expired. Please contact Carter’s team directly to book a time.
                </div>
              )}

              {context.state === "closed" && (
                <div className="rounded-[2rem] border border-stone-900/10 bg-stone-200 px-5 py-4 text-sm text-stone-800">
                  {context.message || "This booking link is no longer available."}
                </div>
              )}
            </div>

            {!bookedState && context.state === "open" && (
              <div className="rounded-[2rem] border border-stone-900/10 bg-white/90 p-6 shadow-sm sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Availability
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-stone-950">{monthLabel}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                        )
                      }
                      disabled={!canGoToPreviousMonth || isLoadingAvailability}
                      className={`rounded-full border p-2 ${
                        canGoToPreviousMonth && !isLoadingAvailability
                          ? "border-stone-300 text-stone-700 hover:bg-stone-100"
                          : "cursor-not-allowed border-stone-200 text-stone-300"
                      }`}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                        )
                      }
                      disabled={isLoadingAvailability}
                      className={`rounded-full border p-2 ${
                        isLoadingAvailability
                          ? "cursor-not-allowed border-stone-200 text-stone-300"
                          : "border-stone-300 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-7 gap-2">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400"
                    >
                      {label}
                    </div>
                  ))}

                  {calendarCells.map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      disabled={!cell.dateKey || !cell.hasAvailability || isLoadingAvailability}
                      onClick={() => {
                        if (!cell.dateKey) {
                          return;
                        }
                        setSelectedDate(cell.dateKey);
                        setSelectedTime((availabilityByDate[cell.dateKey] || [])[0]?.startIso || "");
                      }}
                      className={`aspect-square rounded-2xl text-sm font-semibold transition ${
                        !cell.dateKey
                          ? "cursor-default bg-transparent text-transparent"
                          : selectedDate === cell.dateKey
                            ? "bg-stone-950 text-white"
                            : cell.hasAvailability
                              ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                              : "cursor-not-allowed bg-stone-100 text-stone-300"
                      }`}
                    >
                      {cell.dayNumber}
                    </button>
                  ))}
                </div>

                {isLoadingAvailability && (
                  <div className="mt-5 flex items-center gap-2 text-sm text-stone-500">
                    <Loader2 size={16} className="animate-spin" />
                    Loading available times...
                  </div>
                )}

                {!isLoadingAvailability && availabilityError && (
                  <p className="mt-5 text-sm text-red-700">{availabilityError}</p>
                )}

                {!isLoadingAvailability && !availabilityError && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-stone-800">Available times</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {availableDates.length === 0
                          ? "No dates are currently open."
                          : "Choose a day above, then pick a time."}
                      </p>
                    </div>

                    {selectedSlots.length === 0 && (
                      <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-500">
                        No slots available for the selected day.
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedSlots.map((slot) => (
                        <button
                          key={slot.startIso}
                          type="button"
                          onClick={() => setSelectedTime(slot.startIso)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                            selectedTime === slot.startIso
                              ? "border-stone-950 bg-stone-950 text-white"
                              : "border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100"
                          }`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {bookingError && <p className="mt-5 text-sm text-red-700">{bookingError}</p>}

                <button
                  type="button"
                  onClick={() => void handleBook()}
                  disabled={!selectedTime || isBooking || isLoadingAvailability}
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    !selectedTime || isBooking || isLoadingAvailability
                      ? "cursor-not-allowed bg-stone-200 text-stone-500"
                      : "bg-stone-950 text-white hover:bg-stone-800"
                  }`}
                >
                  {isBooking ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Booking your call...
                    </span>
                  ) : (
                    "Book this time"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default FieldLeadBooking;
