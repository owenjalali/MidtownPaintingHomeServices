import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

type ManageActor = "client" | "carter";
type ManageActionMode = "none" | "cancel" | "reschedule";

type ManageBookingContextResponse = {
  actor: ManageActor;
  booking: {
    eventId: string;
    status: string;
    summary: string;
    clientName: string;
    displayDate: string;
    displayTime: string;
    timezone: string;
    startIso: string;
    endIso: string;
  };
  permissions: {
    canCancel: boolean;
    canReschedule: boolean;
    withinCutoff: boolean;
    cutoffHours: number;
    reason: string | null;
  };
  message?: string;
};

type BookingActionResponse = {
  message?: string;
  booking?: {
    eventId: string;
    status: string;
    summary: string;
    displayDate: string;
    displayTime: string;
    timezone: string;
    startIso: string;
    endIso: string;
  };
};

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

type ManageCredentials = {
  eventId: string;
  actor: ManageActor;
  token: string;
};

const toMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getMonthParam = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const normalizeActor = (value: string | null): ManageActor | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "client" || normalized === "carter") {
    return normalized;
  }
  return null;
};

const fetchWithTimeout = (url: string, opts?: RequestInit, timeoutMs = 45000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
};

const ManageBooking = () => {
  const [searchParams] = useSearchParams();
  const credentials = useMemo<ManageCredentials | null>(() => {
    const actor = normalizeActor(searchParams.get("actor"));
    const eventId = String(searchParams.get("eventId") || "").trim();
    const token = String(searchParams.get("token") || "").trim();

    if (!actor || !eventId || !token) {
      return null;
    }

    return { actor, eventId, token };
  }, [searchParams]);

  const [context, setContext] = useState<ManageBookingContextResponse | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [contextError, setContextError] = useState("");

  const [actionMode, setActionMode] = useState<ManageActionMode>("none");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [currentMonth, setCurrentMonth] = useState<Date>(() => toMonthStart(new Date()));
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, CalendarSlot[]>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const todayMonth = useMemo(() => toMonthStart(new Date()), []);
  const canGoToPreviousMonth = useMemo(
    () =>
      currentMonth.getFullYear() > todayMonth.getFullYear() ||
      (currentMonth.getFullYear() === todayMonth.getFullYear() &&
        currentMonth.getMonth() > todayMonth.getMonth()),
    [currentMonth, todayMonth]
  );
  const monthLabel = useMemo(
    () =>
      currentMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [currentMonth]
  );

  const loadContext = useCallback(async () => {
    if (!credentials) {
      setContextError("This booking link is missing required details.");
      setIsLoadingContext(false);
      return;
    }

    setIsLoadingContext(true);
    setContextError("");

    try {
      const params = new URLSearchParams({
        eventId: credentials.eventId,
        actor: credentials.actor,
        token: credentials.token,
      });
      const response = await fetchWithTimeout(`/api/calendar/manage/context?${params.toString()}`, undefined, 30000);

      let responseBody: ManageBookingContextResponse | { message?: string } = {};
      try {
        responseBody = await response.json();
      } catch {
        responseBody = {};
      }

      if (!response.ok) {
        throw new Error(responseBody.message || "Unable to load booking details.");
      }

      const nextContext = responseBody as ManageBookingContextResponse;
      setContext(nextContext);

      const bookingDate = new Date(nextContext.booking.startIso);
      if (!Number.isNaN(bookingDate.getTime())) {
        setCurrentMonth(toMonthStart(bookingDate));
      }
    } catch (error) {
      setContextError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Request timed out. Please check your connection and try again."
          : error instanceof Error ? error.message : "Unable to load booking details."
      );
      setContext(null);
    } finally {
      setIsLoadingContext(false);
    }
  }, [credentials]);

  const loadAvailability = useCallback(
    async (monthDate: Date) => {
      setAvailabilityError("");
      setIsLoadingAvailability(true);

      try {
        const month = getMonthParam(monthDate);
        const response = await fetchWithTimeout(`/api/calendar/availability?month=${month}`, undefined, 45000);

        let responseBody: AvailabilityResponse | { message?: string } = {
          availabilityByDate: {},
          availableDates: [],
          month,
          timezone: "America/Toronto",
        };

        try {
          responseBody = await response.json();
        } catch {
          responseBody = {
            availabilityByDate: {},
            availableDates: [],
            month,
            timezone: "America/Toronto",
          };
        }

        if (!response.ok) {
          throw new Error(responseBody.message || "Unable to load availability.");
        }

        const availability = responseBody as AvailabilityResponse;
        setAvailabilityByDate(availability.availabilityByDate || {});
        setAvailableDates(availability.availableDates || []);

        const preferredDate =
          selectedDate && (availability.availabilityByDate[selectedDate] || []).length > 0
            ? selectedDate
            : (availability.availableDates || [])[0] || "";
        setSelectedDate(preferredDate);

        if (preferredDate) {
          const preferredSlots = availability.availabilityByDate[preferredDate] || [];
          setSelectedTime(preferredSlots[0]?.startIso || "");
        } else {
          setSelectedTime("");
        }
      } catch (error) {
        setAvailabilityByDate({});
        setAvailableDates([]);
        setSelectedDate("");
        setSelectedTime("");
        setAvailabilityError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Request timed out. Please check your connection and try again."
            : error instanceof Error ? error.message : "Unable to load availability."
        );
      } finally {
        setIsLoadingAvailability(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (actionMode !== "reschedule") {
      return;
    }

    void loadAvailability(currentMonth);
  }, [actionMode, currentMonth, loadAvailability]);

  const selectedSlots = useMemo(
    () => (selectedDate ? availabilityByDate[selectedDate] || [] : []),
    [availabilityByDate, selectedDate]
  );

  const resetActionState = () => {
    setActionError("");
    setActionSuccess("");
    setReason("");
    setActionMode("none");
  };

  const validateReason = () => {
    if (!reason.trim()) {
      setActionError("Please type a reason before submitting.");
      return false;
    }

    return true;
  };

  const handleCancel = async () => {
    if (!credentials || !validateReason()) {
      return;
    }

    setIsSubmitting(true);
    setActionError("");
    setActionSuccess("");

    try {
      const response = await fetchWithTimeout("/api/calendar/manage/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: credentials.eventId,
          actor: credentials.actor,
          token: credentials.token,
          reason: reason.trim(),
        }),
      }, 30000);

      let responseBody: BookingActionResponse = {};
      try {
        responseBody = await response.json();
      } catch {
        responseBody = {};
      }

      if (!response.ok) {
        throw new Error(responseBody.message || "Unable to cancel this booking.");
      }

      setActionSuccess(responseBody.message || "Booking canceled successfully.");
      setActionMode("none");
      setReason("");
      await loadContext();
    } catch (error) {
      setActionError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Request timed out. Please check your connection and try again."
          : error instanceof Error ? error.message : "Unable to cancel this booking."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!credentials || !validateReason()) {
      return;
    }

    if (!selectedTime) {
      setActionError("Please select a new time slot.");
      return;
    }

    setIsSubmitting(true);
    setActionError("");
    setActionSuccess("");

    try {
      const response = await fetchWithTimeout("/api/calendar/manage/reschedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: credentials.eventId,
          actor: credentials.actor,
          token: credentials.token,
          reason: reason.trim(),
          newSlotStartIso: selectedTime,
        }),
      }, 30000);

      let responseBody: BookingActionResponse = {};
      try {
        responseBody = await response.json();
      } catch {
        responseBody = {};
      }

      if (!response.ok) {
        throw new Error(responseBody.message || "Unable to reschedule this booking.");
      }

      setActionSuccess(responseBody.message || "Booking rescheduled successfully.");
      setActionMode("none");
      setReason("");
      await loadContext();
    } catch (error) {
      setActionError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Request timed out. Please check your connection and try again."
          : error instanceof Error ? error.message : "Unable to reschedule this booking."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const actorLabel = context?.actor === "carter" ? "Carter" : "Client";

  return (
    <section className="px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Manage Booking</p>
          <h1 className="text-3xl font-heading font-bold text-gray-900 sm:text-4xl">
            Consultation Update Center
          </h1>
          <p className="text-sm text-gray-600">
            Use this page to cancel or reschedule your 15-minute call with Carter.
          </p>
        </header>

        {!credentials && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This booking link is missing required details. Open the original link from your email again.
          </div>
        )}

        {isLoadingContext && (
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            Loading booking details...
          </div>
        )}

        {!isLoadingContext && contextError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {contextError}
          </div>
        )}

        {!isLoadingContext && !contextError && context && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                Access Level: {actorLabel}
              </p>
              <h2 className="mt-2 text-xl font-bold text-gray-900">{context.booking.summary}</h2>
              <div className="mt-4 space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-primary" />
                  {context.booking.displayDate}
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  {context.booking.displayTime}
                </div>
              </div>
            </div>

            {context.permissions.reason && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{context.permissions.reason}</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!context.permissions.canReschedule || isSubmitting}
                onClick={() => {
                  setActionMode("reschedule");
                  setActionError("");
                  setActionSuccess("");
                }}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                  context.permissions.canReschedule && !isSubmitting
                    ? "bg-black text-white hover:bg-gray-800"
                    : "cursor-not-allowed bg-gray-200 text-gray-500"
                }`}
              >
                Reschedule
              </button>
              <button
                type="button"
                disabled={!context.permissions.canCancel || isSubmitting}
                onClick={() => {
                  setActionMode("cancel");
                  setActionError("");
                  setActionSuccess("");
                }}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                  context.permissions.canCancel && !isSubmitting
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "cursor-not-allowed bg-gray-200 text-gray-500"
                }`}
              >
                Cancel Booking
              </button>
              <button
                type="button"
                onClick={() => void loadContext()}
                className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              >
                Refresh
              </button>
            </div>

            {actionMode !== "none" && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-lg font-bold text-gray-900">
                  {actionMode === "cancel" ? "Cancel this booking" : "Choose a new time"}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Type your reason below. This will be sent to both the client and Carter.
                </p>

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={
                    actionMode === "cancel"
                      ? "Why are you cancelling this call?"
                      : "Why are you rescheduling this call?"
                  }
                  className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />

                {actionMode === "reschedule" && (
                  <div className="mt-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">{monthLabel}</h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentMonth((prev) => toMonthStart(new Date(prev.getFullYear(), prev.getMonth() - 1, 1)))}
                          disabled={!canGoToPreviousMonth || isLoadingAvailability}
                          className={`rounded-lg border p-1.5 ${
                            canGoToPreviousMonth && !isLoadingAvailability
                              ? "border-gray-300 text-gray-700 hover:bg-gray-100"
                              : "cursor-not-allowed border-gray-200 text-gray-300"
                          }`}
                          aria-label="Previous month"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentMonth((prev) => toMonthStart(new Date(prev.getFullYear(), prev.getMonth() + 1, 1)))}
                          disabled={isLoadingAvailability}
                          className={`rounded-lg border p-1.5 ${
                            isLoadingAvailability
                              ? "cursor-not-allowed border-gray-200 text-gray-300"
                              : "border-gray-300 text-gray-700 hover:bg-gray-100"
                          }`}
                          aria-label="Next month"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {isLoadingAvailability && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 size={16} className="animate-spin" />
                        Loading available times...
                      </div>
                    )}

                    {!isLoadingAvailability && availabilityError && (
                      <p className="text-sm text-red-600">{availabilityError}</p>
                    )}

                    {!isLoadingAvailability && !availabilityError && (
                      <>
                        <label className="block text-sm font-semibold text-gray-700">
                          Available date
                          <select
                            value={selectedDate}
                            onChange={(event) => {
                              const nextDate = event.target.value;
                              setSelectedDate(nextDate);
                              setSelectedTime((availabilityByDate[nextDate] || [])[0]?.startIso || "");
                            }}
                            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          >
                            {availableDates.length === 0 && <option value="">No dates available</option>}
                            {availableDates.map((date) => (
                              <option key={date} value={date}>
                                {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                                  weekday: "long",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-700">Available times</p>
                          {selectedSlots.length === 0 && (
                            <p className="text-sm text-gray-500">No slots available for this date.</p>
                          )}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {selectedSlots.map((slot) => (
                              <button
                                key={slot.startIso}
                                type="button"
                                onClick={() => setSelectedTime(slot.startIso)}
                                className={`rounded-xl border px-4 py-2 text-left text-sm font-semibold transition-colors ${
                                  selectedTime === slot.startIso
                                    ? "border-primary bg-primary text-white"
                                    : "border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"
                                }`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {actionMode === "cancel" ? (
                    <button
                      type="button"
                      onClick={() => void handleCancel()}
                      disabled={isSubmitting}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
                        isSubmitting
                          ? "cursor-not-allowed bg-gray-200 text-gray-500"
                          : "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      {isSubmitting ? "Submitting..." : "Confirm Cancellation"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleReschedule()}
                      disabled={isSubmitting || isLoadingAvailability}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
                        isSubmitting || isLoadingAvailability
                          ? "cursor-not-allowed bg-gray-200 text-gray-500"
                          : "bg-black text-white hover:bg-gray-800"
                      }`}
                    >
                      {isSubmitting ? "Submitting..." : "Confirm Reschedule"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={resetActionState}
                    disabled={isSubmitting}
                    className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            {actionSuccess && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ManageBooking;
