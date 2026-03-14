import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useParams } from "react-router-dom";
import type { FieldLeadCreateResponse, FieldRepOption } from "../lib/fieldLead";

type FieldConfigResponse = {
  ok: true;
  message?: string;
  repOptions: FieldRepOption[];
  linkExpiryDays: number;
};

const fetchWithTimeout = (url: string, opts?: RequestInit, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => window.clearTimeout(timeoutId));
};

const FieldRepIntake = () => {
  const { accessKey = "" } = useParams();
  const [repOptions, setRepOptions] = useState<FieldRepOption[]>([]);
  const [linkExpiryDays, setLinkExpiryDays] = useState(7);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState("");

  const [repId, setRepId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [projectNotes, setProjectNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState<FieldLeadCreateResponse | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      if (!accessKey.trim()) {
        setConfigError("This field intake link is invalid.");
        setIsLoadingConfig(false);
        return;
      }

      setIsLoadingConfig(true);
      setConfigError("");

      try {
        const params = new URLSearchParams({ accessKey });
        const response = await fetchWithTimeout(`/api/field/config?${params.toString()}`);
        const responseBody: FieldConfigResponse | { message?: string } = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(responseBody.message || "Unable to load field rep options.");
        }

        const nextConfig = responseBody as FieldConfigResponse;
        setRepOptions(nextConfig.repOptions || []);
        setLinkExpiryDays(nextConfig.linkExpiryDays || 7);
        setRepId(nextConfig.repOptions?.[0]?.id || "");
      } catch (error) {
        setConfigError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Unable to load field rep options."
        );
      } finally {
        setIsLoadingConfig(false);
      }
    };

    void loadConfig();
  }, [accessKey]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (!repId || !fullName.trim() || !phone.trim() || !projectNotes.trim()) {
      setSubmitError("Rep, homeowner name, phone, and project notes are required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(null);

    try {
      const response = await fetchWithTimeout("/api/field/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessKey,
          repId,
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          projectNotes: projectNotes.trim(),
        }),
      });
      const responseBody: FieldLeadCreateResponse | { message?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseBody.message || "Unable to create this field lead.");
      }

      const successBody = responseBody as FieldLeadCreateResponse;
      setSubmitSuccess(successBody);
      setFullName("");
      setPhone("");
      setAddress("");
      setProjectNotes("");
    } catch (error) {
      setSubmitError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Unable to create this field lead."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-stone-950 px-4 py-8 text-stone-50 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.28),_transparent_42%),linear-gradient(180deg,rgba(28,25,23,0.98),rgba(12,10,9,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 px-5 py-5 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
              Field Intake
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Door-to-door lead capture
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-300">
              Capture the homeowner details, save the lead to the field-test lead log, and queue the
              first booking text after the configured preview delay.
            </p>
          </div>

          <div className="px-5 py-6 sm:px-8">
            {isLoadingConfig && (
              <div className="flex items-center gap-2 text-sm text-stone-300">
                <Loader2 size={16} className="animate-spin" />
                Loading reps...
              </div>
            )}

            {!isLoadingConfig && configError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{configError}</span>
                </div>
              </div>
            )}

            {!isLoadingConfig && !configError && (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-stone-200">
                  Rep
                  <select
                    value={repId}
                    onChange={(event) => setRepId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-amber-400"
                  >
                    {repOptions.map((option) => (
                      <option key={option.id} value={option.id} className="bg-stone-900 text-white">
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-stone-200">
                  Homeowner name
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Jane Smith"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-stone-500 outline-none transition focus:border-amber-400"
                  />
                </label>

                <label className="block text-sm font-medium text-stone-200">
                  Homeowner phone
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+16475551234"
                    inputMode="tel"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-stone-500 outline-none transition focus:border-amber-400"
                  />
                </label>

                <label className="block text-sm font-medium text-stone-200">
                  Address
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="123 Example Street"
                    autoComplete="street-address"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-stone-500 outline-none transition focus:border-amber-400"
                  />
                </label>

                <label className="block text-sm font-medium text-stone-200">
                  Project notes
                  <textarea
                    value={projectNotes}
                    onChange={(event) => setProjectNotes(event.target.value)}
                    rows={4}
                    placeholder="Exterior trim peeling, wants a call with Carter this week."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-stone-500 outline-none transition focus:border-amber-400"
                  />
                </label>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300">
                  Booking links expire after {linkExpiryDays} day{linkExpiryDays === 1 ? "" : "s"}.
                </div>

                {submitError && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {submitError}
                  </div>
                )}

                {submitSuccess && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Lead captured.</p>
                        <p className="mt-1 text-emerald-100">
                          First text scheduled for{" "}
                          {new Date(submitSuccess.initialSmsScheduledForIso).toLocaleString()}.
                        </p>
                        {submitSuccess.manualTest?.bookingLink && (
                          <div className="mt-3 space-y-2">
                            <a
                              href={submitSuccess.manualTest.bookingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                            >
                              Open booking link now
                            </a>
                            <p className="text-xs leading-5 text-emerald-100/90">
                              Preview/local only: this link is exposed immediately for manual QA so
                              you do not need to wait for the delayed SMS.
                            </p>
                            <p className="text-xs leading-5 text-emerald-100/90">
                              {submitSuccess.manualTest.outboundOverrideEnabled
                                ? "Preview outbound override is enabled, so field emails and texts stay routed to the configured test recipients."
                                : "Preview outbound override is disabled, so the delayed SMS and booking notifications will use the lead and owner phone/email values from this test flow."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    isSubmitting
                      ? "cursor-not-allowed bg-stone-700 text-stone-300"
                      : "bg-amber-400 text-stone-950 hover:bg-amber-300"
                  }`}
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {isSubmitting ? "Saving lead..." : "Save lead and queue first text"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FieldRepIntake;
