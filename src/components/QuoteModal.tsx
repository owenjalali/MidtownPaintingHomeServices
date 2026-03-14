import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Calendar as CalendarIcon, Clock, ChevronRight, ChevronLeft, UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import gsap from 'gsap';

type CalendarSlot = {
    startIso: string;
    endIso: string;
    label: string;
};

type AvailabilityResponse = {
    month: string;
    timezone: string;
    durationMinutes: number;
    availabilityByDate: Record<string, CalendarSlot[]>;
    availableDates: string[];
    message?: string;
};

type BookingResponse = {
    message?: string;
    booking?: {
        eventId: string | null;
        displayDate: string;
        displayTime: string;
        timezone: string;
        startIso: string;
        endIso: string;
        manageLinks?: {
            client: string | null;
            carter: string | null;
        };
    };
    reminders?: Array<{
        reminderMinutesBefore: number;
        sendEmail: boolean;
        sendSms: boolean;
        reminderAtIso: string;
        reminderAtLabel: string;
        runId: string | null;
        delayApplied: boolean;
    }>;
};

type FormValues = {
    fullName: string;
    phoneCountryCode: string;
    phoneNationalNumber: string;
    email: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string;
    provinceState: string;
    projectType: string;
    projectDetails: string;
    callGoal: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const PHONE_COUNTRY_OPTIONS = [
    { value: '+1', label: 'CA/US (+1)' },
    { value: '+44', label: 'UK (+44)' },
    { value: '+61', label: 'AU (+61)' },
    { value: '+64', label: 'NZ (+64)' }
];
const COUNTRY_OPTIONS = [
    { value: 'CA', label: 'Canada' },
    { value: 'US', label: 'United States' },
    { value: 'UK', label: 'United Kingdom' },
    { value: 'AU', label: 'Australia' },
    { value: 'NZ', label: 'New Zealand' }
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const REPEATING_DIGIT_PATTERN = /^(\d)\1{6,}$/;
const REPEATING_BLOCK_PATTERN = /^(\d{2,4})\1{2,}$/;
const DEFAULT_CALENDAR_TIMEZONE = 'America/Toronto';

const createMonthDate = (year: number, month: number) => new Date(year, month, 1);
const getCurrentMonthDate = (timeZone = DEFAULT_CALENDAR_TIMEZONE) => {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: 'numeric'
        });
        const parts = formatter.formatToParts(new Date());
        const year = Number(parts.find((part) => part.type === 'year')?.value);
        const month = Number(parts.find((part) => part.type === 'month')?.value);
        if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
            return createMonthDate(year, month - 1);
        }
    } catch {
        // Fallback below.
    }

    const now = new Date();
    return createMonthDate(now.getFullYear(), now.getMonth());
};

const getMonthParam = (monthDate: Date) =>
    `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

const getDateKey = (year: number, monthIndex: number, day: number) =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const dateFromKey = (key: string) => {
    const [yearToken, monthToken, dayToken] = key.split('-');
    const year = Number(yearToken);
    const month = Number(monthToken);
    const day = Number(dayToken);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }

    return new Date(year, month - 1, day);
};

const createInitialFormValues = (): FormValues => ({
    fullName: '',
    phoneCountryCode: '+1',
    phoneNationalNumber: '',
    email: '',
    addressLine1: '',
    city: '',
    postalCode: '',
    country: 'CA',
    provinceState: '',
    projectType: '',
    projectDetails: '',
    callGoal: ''
});

const normalizeDigits = (value: string) => value.replace(/\D/g, '');

const formatNorthAmericanPhone = (digits: string) => {
    const clean = digits.slice(0, 10);
    if (clean.length <= 3) {
        return clean;
    }

    if (clean.length <= 6) {
        return `(${clean.slice(0, 3)}) ${clean.slice(3)}`;
    }

    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
};

const formatInternationalPhone = (digits: string) => {
    const clean = digits.slice(0, 15);
    return clean.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
};

const formatPhoneInputValue = (input: string, countryCode: string) => {
    const digits = normalizeDigits(input);
    if (!digits) {
        return '';
    }

    return countryCode === '+1'
        ? formatNorthAmericanPhone(digits)
        : formatInternationalPhone(digits);
};

const normalizeCountry = (country: string) => country.trim().toUpperCase();

const normalizePostalCode = (postalCode: string, country: string) => {
    const compact = postalCode.trim().toUpperCase().replace(/\s+/g, ' ');
    if (normalizeCountry(country) === 'CA') {
        const noSpaces = compact.replace(/\s+/g, '');
        if (noSpaces.length >= 6) {
            return `${noSpaces.slice(0, 3)} ${noSpaces.slice(3, 6)}`;
        }
    }

    return compact;
};

const isValidPostalCode = (postalCode: string, country: string) => {
    const normalizedCountry = normalizeCountry(country);
    if (normalizedCountry === 'CA') {
        return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(postalCode);
    }

    if (normalizedCountry === 'US') {
        return /^\d{5}(-\d{4})?$/.test(postalCode);
    }

    if (normalizedCountry === 'UK') {
        return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(postalCode);
    }

    return postalCode.trim().length >= 3;
};

const isValidEmailAddress = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        return false;
    }

    if (normalizedEmail.includes('..')) {
        return false;
    }

    const [localPart = '', domainPart = ''] = normalizedEmail.split('@');
    if (!localPart || !domainPart) {
        return false;
    }

    if (
        localPart.startsWith('.') ||
        localPart.endsWith('.') ||
        domainPart.startsWith('-') ||
        domainPart.endsWith('-')
    ) {
        return false;
    }

    return true;
};

const toE164Phone = (countryCode: string, phoneNumber: string) => {
    const countryDigits = normalizeDigits(countryCode);
    if (!countryDigits) {
        return null;
    }

    let localDigits = normalizeDigits(phoneNumber);
    if (!localDigits) {
        return null;
    }

    if (localDigits.startsWith(countryDigits) && localDigits.length > 7) {
        localDigits = localDigits.slice(countryDigits.length);
    }

    if (countryDigits !== '1') {
        localDigits = localDigits.replace(/^0+/, '');
    }

    const fullDigits = `${countryDigits}${localDigits}`;
    if (fullDigits.length < 8 || fullDigits.length > 15) {
        return null;
    }

    return `+${fullDigits}`;
};

const hasSuspiciousPhonePattern = (phoneNumber: string) => {
    const digits = normalizeDigits(phoneNumber);
    if (digits.length < 7) {
        return true;
    }

    return REPEATING_DIGIT_PATTERN.test(digits) || REPEATING_BLOCK_PATTERN.test(digits);
};

const fetchWithTimeout = (url: string, opts?: RequestInit, timeoutMs = 45000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
};

const QuoteModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'form' | 'calendar' | 'success'>('form');
    const modalRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [budget, setBudget] = useState(500);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState<Date>(() => getCurrentMonthDate(DEFAULT_CALENDAR_TIMEZONE));
    const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, CalendarSlot[]>>({});
    const [calendarTimezone, setCalendarTimezone] = useState(DEFAULT_CALENDAR_TIMEZONE);
    const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
    const [availabilityError, setAvailabilityError] = useState('');
    const [isBooking, setIsBooking] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [confirmedBooking, setConfirmedBooking] = useState<{
        displayDate: string;
        displayTime: string;
        reminderLabels: string[];
        manageLink: string | null;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [formValues, setFormValues] = useState<FormValues>(() => createInitialFormValues());
    const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

    const resetFormState = () => {
        setBudget(500);
        setSelectedTime(null);
        setSelectedDate(null);
        setCurrentMonth(getCurrentMonthDate(DEFAULT_CALENDAR_TIMEZONE));
        setAvailabilityByDate({});
        setCalendarTimezone(DEFAULT_CALENDAR_TIMEZONE);
        setIsLoadingAvailability(false);
        setAvailabilityError('');
        setIsBooking(false);
        setBookingError('');
        setConfirmedBooking(null);
        setIsSubmitting(false);
        setSubmitError('');
        setUploadError('');
        setUploadedImages([]);
        setFormValues(createInitialFormValues());
        setFieldErrors({});
    };

    useEffect(() => {
        const handleOpen = () => {
            setIsOpen(true);
            setStep('form');
            document.body.style.overflow = 'hidden';

            // Initial animation
            setTimeout(() => {
                if (contentRef.current && modalRef.current) {
                    gsap.fromTo(modalRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
                    gsap.fromTo(contentRef.current, { y: 50, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
                }
            }, 10);
        };

        window.addEventListener('open-quote', handleOpen);
        return () => window.removeEventListener('open-quote', handleOpen);
    }, []);

    const handleClose = () => {
        if (contentRef.current && modalRef.current) {
            gsap.to(contentRef.current, { y: 20, opacity: 0, scale: 0.95, duration: 0.3, ease: 'power2.in' });
            gsap.to(modalRef.current, {
                opacity: 0, duration: 0.3, onComplete: () => {
                    setIsOpen(false);
                    document.body.style.overflow = 'auto';
                    resetFormState();
                }
            });
        } else {
            setIsOpen(false);
            document.body.style.overflow = 'auto';
            resetFormState();
        }
    };

    const transitionToCalendar = () => {
        setCurrentMonth(getCurrentMonthDate(DEFAULT_CALENDAR_TIMEZONE));
        setBookingError('');
        setAvailabilityError('');
        setConfirmedBooking(null);
        setSelectedTime(null);
        if (contentRef.current) {
            gsap.to(contentRef.current, {
                opacity: 0, y: -20, duration: 0.3, onComplete: () => {
                    setStep('calendar');
                    gsap.fromTo(contentRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
                }
            });
        } else {
            setStep('calendar');
        }
    };

    const transitionToSuccess = () => {
        if (contentRef.current) {
            gsap.to(contentRef.current, {
                opacity: 0, scale: 0.95, duration: 0.3, onComplete: () => {
                    setStep('success');
                    gsap.fromTo(contentRef.current, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' });
                }
            });
            return;
        }

        setStep('success');
    };

    const loadCalendarAvailability = useCallback(async () => {
        const month = getMonthParam(currentMonth);
        setIsLoadingAvailability(true);
        setAvailabilityError('');
        setBookingError('');

        try {
            const response = await fetchWithTimeout(`/api/calendar/availability?month=${month}`, undefined, 45000);
            let responseBody: AvailabilityResponse = {
                month,
                timezone: 'America/Toronto',
                durationMinutes: 15,
                availabilityByDate: {},
                availableDates: []
            };

            try {
                responseBody = await response.json();
            } catch {
                responseBody = {
                    month,
                    timezone: 'America/Toronto',
                    durationMinutes: 15,
                    availabilityByDate: {},
                    availableDates: []
                };
            }

            if (!response.ok) {
                throw new Error(responseBody.message || 'Unable to load Carter\'s availability right now.');
            }

            const availabilityMap = responseBody.availabilityByDate ?? {};
            const datesWithAvailability = Object.keys(availabilityMap)
                .filter((dateKey) => (availabilityMap[dateKey] ?? []).length > 0)
                .sort();

            setAvailabilityByDate(availabilityMap);
            setCalendarTimezone(responseBody.timezone || 'America/Toronto');
            setSelectedDate((existingDate) =>
                existingDate && (availabilityMap[existingDate] ?? []).length > 0
                    ? existingDate
                    : (datesWithAvailability[0] ?? null)
            );
            setSelectedTime(null);
        } catch (error) {
            setAvailabilityByDate({});
            setSelectedDate(null);
            setSelectedTime(null);
            setAvailabilityError(
                error instanceof DOMException && error.name === 'AbortError'
                    ? 'Request timed out. Please check your connection and try again.'
                    : error instanceof Error
                        ? error.message
                        : 'Unable to load Carter\'s availability right now.'
            );
        } finally {
            setIsLoadingAvailability(false);
        }
    }, [currentMonth]);

    useEffect(() => {
        if (step !== 'calendar') {
            return;
        }

        void loadCalendarAvailability();
    }, [step, loadCalendarAvailability]);

    const goToPreviousMonth = () => {
        setCurrentMonth((current) => createMonthDate(current.getFullYear(), current.getMonth() - 1));
        setSelectedDate(null);
        setSelectedTime(null);
    };

    const goToNextMonth = () => {
        setCurrentMonth((current) => createMonthDate(current.getFullYear(), current.getMonth() + 1));
        setSelectedDate(null);
        setSelectedTime(null);
    };

    const handleDateSelection = (dateKey: string) => {
        if ((availabilityByDate[dateKey] ?? []).length === 0 || isLoadingAvailability) {
            return;
        }

        setSelectedDate(dateKey);
        setSelectedTime(null);
        setBookingError('');
    };

    const validateFormValues = (values: FormValues) => {
        const errors: FormErrors = {};
        const normalizedEmail = values.email.trim().toLowerCase();
        const normalizedPostalCode = normalizePostalCode(values.postalCode, values.country);
        const normalizedPhone = toE164Phone(values.phoneCountryCode, values.phoneNationalNumber);

        if (!values.fullName.trim()) {
            errors.fullName = 'Full name is required.';
        }

        if (!values.phoneNationalNumber.trim()) {
            errors.phoneNationalNumber = 'Phone number is required.';
        } else if (!normalizedPhone || hasSuspiciousPhonePattern(values.phoneNationalNumber)) {
            errors.phoneNationalNumber = 'Enter a valid phone number.';
        }

        if (!normalizedEmail) {
            errors.email = 'Email address is required.';
        } else if (!isValidEmailAddress(normalizedEmail)) {
            errors.email = 'Enter a valid email address.';
        }

        if (!values.addressLine1.trim()) {
            errors.addressLine1 = 'Address is required.';
        }

        if (!values.city.trim()) {
            errors.city = 'City is required.';
        }

        if (!values.country.trim()) {
            errors.country = 'Country is required.';
        }

        if (!values.provinceState.trim()) {
            errors.provinceState = 'Province or state is required.';
        }

        if (!values.postalCode.trim()) {
            errors.postalCode = 'Postal code is required.';
        } else if (!isValidPostalCode(normalizedPostalCode, values.country)) {
            errors.postalCode = 'Enter a valid postal code.';
        }

        if (!values.projectType) {
            errors.projectType = 'Select a project type.';
        }

        if (!values.projectDetails.trim()) {
            errors.projectDetails = 'Project details are required.';
        }

        return {
            errors,
            normalizedEmail,
            normalizedPhone,
            normalizedPostalCode,
            normalizedCountry: normalizeCountry(values.country),
            normalizedCity: values.city.trim(),
            normalizedProvinceState: values.provinceState.trim(),
            normalizedAddressLine1: values.addressLine1.trim()
        };
    };

    const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const fieldName = name as keyof FormValues;
        setSubmitError('');
        setFieldErrors((current) => {
            const next = { ...current };
            delete next[fieldName];
            if (fieldName === 'country') {
                delete next.postalCode;
            }
            if (fieldName === 'phoneCountryCode') {
                delete next.phoneNationalNumber;
            }
            return next;
        });

        if (fieldName === 'phoneNationalNumber') {
            setFormValues((current) => ({
                ...current,
                phoneNationalNumber: formatPhoneInputValue(value, current.phoneCountryCode)
            }));
            return;
        }

        if (fieldName === 'phoneCountryCode') {
            setFormValues((current) => ({
                ...current,
                phoneCountryCode: value,
                phoneNationalNumber: formatPhoneInputValue(current.phoneNationalNumber, value)
            }));
            return;
        }

        if (fieldName === 'postalCode') {
            setFormValues((current) => ({
                ...current,
                postalCode: normalizePostalCode(value, current.country)
            }));
            return;
        }

        if (fieldName === 'country') {
            setFormValues((current) => ({
                ...current,
                country: value,
                postalCode: normalizePostalCode(current.postalCode, value)
            }));
            return;
        }

        setFormValues((current) => ({
            ...current,
            [fieldName]: value
        }));
    };

    const addUploadedFiles = (incomingFiles: File[]) => {
        if (!incomingFiles.length) {
            return;
        }

        setUploadError('');

        const maxFileSizeInBytes = 10 * 1024 * 1024;
        const oversizedFiles = incomingFiles.filter((file) => file.size > maxFileSizeInBytes);
        const nonImageFiles = incomingFiles.filter((file) => !file.type.startsWith('image/'));

        if (oversizedFiles.length || nonImageFiles.length) {
            const errors: string[] = [];
            if (oversizedFiles.length) {
                errors.push('Each image must be 10MB or smaller.');
            }
            if (nonImageFiles.length) {
                errors.push('Only image files are allowed.');
            }
            setUploadError(errors.join(' '));
        }

        const validFiles = incomingFiles.filter(
            (file) => file.size <= maxFileSizeInBytes && file.type.startsWith('image/')
        );

        if (!validFiles.length) {
            return;
        }

        const maxFiles = 8;
        setUploadedImages((current) => {
            const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
            const dedupedIncoming = validFiles.filter((file) => {
                const key = `${file.name}-${file.size}-${file.lastModified}`;
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });

            const merged = [...current, ...dedupedIncoming];
            return merged.slice(0, maxFiles);
        });
    };

    const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingFiles(false);
        addUploadedFiles(Array.from(e.dataTransfer.files));
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        addUploadedFiles(Array.from(e.target.files ?? []));
        e.target.value = '';
    };

    const removeUploadedFile = (indexToRemove: number) => {
        setUploadedImages((current) => current.filter((_, index) => index !== indexToRemove));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) {
            return;
        }

        const validation = validateFormValues(formValues);
        if (Object.keys(validation.errors).length > 0 || !validation.normalizedPhone) {
            setFieldErrors(validation.errors);
            setSubmitError('Please fix the highlighted fields before continuing.');
            return;
        }

        setSubmitError('');
        setIsSubmitting(true);
        setFieldErrors({});

        const payload = new FormData();
        payload.append('fullName', formValues.fullName.trim());
        payload.append('phone', validation.normalizedPhone);
        payload.append('phoneCountryCode', formValues.phoneCountryCode);
        payload.append('phoneNationalNumber', normalizeDigits(formValues.phoneNationalNumber));
        payload.append('email', validation.normalizedEmail);
        payload.append('addressLine1', validation.normalizedAddressLine1);
        payload.append('city', validation.normalizedCity);
        payload.append('postalCode', validation.normalizedPostalCode);
        payload.append('country', validation.normalizedCountry);
        payload.append('provinceState', validation.normalizedProvinceState);
        payload.append('projectType', formValues.projectType);
        payload.append('projectDetails', formValues.projectDetails.trim());
        payload.append('budget', budget.toString());
        payload.append('callGoal', formValues.callGoal.trim());
        uploadedImages.forEach((file) => payload.append('images', file, file.name));

        try {
            const response = await fetchWithTimeout('/api/quote', {
                method: 'POST',
                body: payload
            }, 60000);

            let responseBody: { message?: string } = {};
            try {
                responseBody = await response.json();
            } catch {
                responseBody = {};
            }

            if (!response.ok) {
                throw new Error(responseBody.message || 'Unable to send your request right now.');
            }

            transitionToCalendar();
        } catch (error) {
            setSubmitError(
                error instanceof DOMException && error.name === 'AbortError'
                    ? 'Request timed out. Please check your connection and try again.'
                    : error instanceof Error
                        ? error.message
                        : 'We could not send your request. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBookingSelect = async () => {
        if (!selectedTime || isBooking) {
            return;
        }

        const validation = validateFormValues(formValues);
        if (Object.keys(validation.errors).length > 0 || !validation.normalizedPhone) {
            setFieldErrors(validation.errors);
            setBookingError('Contact details are invalid. Go back and update the form.');
            return;
        }

        setBookingError('');
        setIsBooking(true);

        try {
            const response = await fetchWithTimeout('/api/calendar/booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    slotStartIso: selectedTime,
                    fullName: formValues.fullName.trim(),
                    phone: validation.normalizedPhone,
                    phoneCountryCode: formValues.phoneCountryCode,
                    phoneNationalNumber: normalizeDigits(formValues.phoneNationalNumber),
                    email: validation.normalizedEmail,
                    addressLine1: validation.normalizedAddressLine1,
                    city: validation.normalizedCity,
                    postalCode: validation.normalizedPostalCode,
                    country: validation.normalizedCountry,
                    provinceState: validation.normalizedProvinceState,
                    projectType: formValues.projectType,
                    projectDetails: formValues.projectDetails.trim(),
                    budget: budget.toString(),
                    callGoal: formValues.callGoal.trim()
                })
            }, 45000);

            let responseBody: BookingResponse = {};
            try {
                responseBody = await response.json();
            } catch {
                responseBody = {};
            }

            if (!response.ok) {
                throw new Error(responseBody.message || 'Unable to book this slot right now.');
            }

            if (responseBody.booking) {
                const reminderLabels = Array.isArray(responseBody.reminders)
                    ? responseBody.reminders
                        .filter((reminder) => reminder.sendEmail || reminder.sendSms)
                        .map((reminder) => reminder.reminderAtLabel)
                    : [];

                setConfirmedBooking({
                    displayDate: responseBody.booking.displayDate,
                    displayTime: responseBody.booking.displayTime,
                    reminderLabels,
                    manageLink: responseBody.booking.manageLinks?.client || null
                });
            }

            transitionToSuccess();
        } catch (error) {
            const message = error instanceof DOMException && error.name === 'AbortError'
                ? 'Request timed out. Please check your connection and try again.'
                : error instanceof Error ? error.message : 'Unable to book this slot right now.';
            setBookingError(message);

            if (message.toLowerCase().includes('just booked')) {
                void loadCalendarAvailability();
            }
        } finally {
            setIsBooking(false);
        }
    };

    const todayMonth = getCurrentMonthDate();

    const canGoToPreviousMonth =
        currentMonth.getFullYear() > todayMonth.getFullYear() ||
        (currentMonth.getFullYear() === todayMonth.getFullYear() &&
            currentMonth.getMonth() > todayMonth.getMonth());

    const calendarMonthLabel = currentMonth.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
    });

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
                hasAvailability: false
            });
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const dateKey = getDateKey(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const daySlots = availabilityByDate[dateKey] ?? [];
            cells.push({
                key: dateKey,
                dayNumber: day,
                dateKey,
                hasAvailability: daySlots.length > 0
            });
        }

        return cells;
    }, [availabilityByDate, currentMonth, daysInMonth, firstDayOffset]);

    const selectedDateSlots = selectedDate ? (availabilityByDate[selectedDate] ?? []) : [];

    const selectedDateLabel = useMemo(() => {
        if (!selectedDate) {
            return 'Select an available day';
        }

        const selected = dateFromKey(selectedDate);
        if (!selected) {
            return 'Select an available day';
        }

        return selected.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    }, [selectedDate]);

    if (!isOpen) return null;

    return (
        <div ref={modalRef} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 opacity-0">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={handleClose}
            />

            <div
                ref={contentRef}
                className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl custom-scrollbar"
                style={{ opacity: 0 }}
            >
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors z-10"
                >
                    <X className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                </button>

                <div className="p-5 sm:p-8 md:p-12">
                    {step === 'form' && (
                        <div className="space-y-6 sm:space-y-8">
                            <div className="pr-8">
                                <h2 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">Request a Quote</h2>
                                <p className="text-gray-500 font-body mt-2 text-sm sm:text-base">Let's discuss your vision. Fill out the details below to schedule a call with Carter Jenkins.</p>
                            </div>

                            <form onSubmit={handleFormSubmit} className="space-y-5 sm:space-y-6 font-body">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Full Name *</label>
                                        <input
                                            required
                                            type="text"
                                            name="fullName"
                                            value={formValues.fullName}
                                            onChange={handleFieldChange}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                            placeholder="John Doe"
                                        />
                                        {fieldErrors.fullName && (
                                            <p className="text-sm text-red-600">{fieldErrors.fullName}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Phone Number *</label>
                                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden">
                                            <div className="relative border-r border-gray-200 shrink-0">
                                                <select
                                                    required
                                                    name="phoneCountryCode"
                                                    value={formValues.phoneCountryCode}
                                                    onChange={handleFieldChange}
                                                    className="pl-3 pr-8 py-3 bg-transparent border-none focus:ring-0 outline-none appearance-none cursor-pointer text-gray-700 font-medium text-sm sm:text-base min-w-[125px]"
                                                >
                                                    {PHONE_COUNTRY_OPTIONS.map((option, index) => (
                                                        <option key={`${option.label}-${index}`} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                                </div>
                                            </div>
                                            <input
                                                required
                                                type="tel"
                                                name="phoneNationalNumber"
                                                value={formValues.phoneNationalNumber}
                                                onChange={handleFieldChange}
                                                inputMode="tel"
                                                autoComplete="tel-national"
                                                className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 outline-none"
                                                placeholder="(647) 555-1234"
                                            />
                                        </div>
                                        {fieldErrors.phoneNationalNumber && (
                                            <p className="text-sm text-red-600">{fieldErrors.phoneNationalNumber}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Email Address *</label>
                                    <input
                                        required
                                        type="email"
                                        name="email"
                                        value={formValues.email}
                                        onChange={handleFieldChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                        placeholder="john@example.com"
                                    />
                                    {fieldErrors.email && (
                                        <p className="text-sm text-red-600">{fieldErrors.email}</p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-gray-700">Project Address *</label>
                                    <div className="space-y-2">
                                        <input
                                            required
                                            type="text"
                                            name="addressLine1"
                                            value={formValues.addressLine1}
                                            onChange={handleFieldChange}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                            placeholder="Street Address"
                                        />
                                        {fieldErrors.addressLine1 && (
                                            <p className="text-sm text-red-600">{fieldErrors.addressLine1}</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <input
                                                required
                                                type="text"
                                                name="city"
                                                value={formValues.city}
                                                onChange={handleFieldChange}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                                placeholder="City"
                                            />
                                            {fieldErrors.city && (
                                                <p className="text-sm text-red-600">{fieldErrors.city}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <input
                                                required
                                                type="text"
                                                name="provinceState"
                                                value={formValues.provinceState}
                                                onChange={handleFieldChange}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                                placeholder="Province / State"
                                            />
                                            {fieldErrors.provinceState && (
                                                <p className="text-sm text-red-600">{fieldErrors.provinceState}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <input
                                                required
                                                type="text"
                                                name="postalCode"
                                                value={formValues.postalCode}
                                                onChange={handleFieldChange}
                                                inputMode="text"
                                                autoComplete="postal-code"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                                placeholder="Postal / ZIP Code"
                                            />
                                            {fieldErrors.postalCode && (
                                                <p className="text-sm text-red-600">{fieldErrors.postalCode}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <select
                                                required
                                                name="country"
                                                value={formValues.country}
                                                onChange={handleFieldChange}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="" disabled>Select country</option>
                                                {COUNTRY_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {fieldErrors.country && (
                                                <p className="text-sm text-red-600">{fieldErrors.country}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">What type of work is this? *</label>
                                    <select
                                        required
                                        name="projectType"
                                        value={formValues.projectType}
                                        onChange={handleFieldChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Select an option</option>
                                        <option value="interior">Interior Painting</option>
                                        <option value="exterior">Exterior Painting</option>
                                        <option value="both">Both Interior & Exterior</option>
                                        <option value="wood-staining">Wood Staining</option>
                                        <option value="other">Other / Not Sure</option>
                                    </select>
                                    {fieldErrors.projectType && (
                                        <p className="text-sm text-red-600">{fieldErrors.projectType}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Tell us a bit about your project *</label>
                                    <textarea
                                        required
                                        rows={4}
                                        name="projectDetails"
                                        value={formValues.projectDetails}
                                        onChange={handleFieldChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                                        placeholder="What spaces are we painting? Any specific details?"
                                    ></textarea>
                                    {fieldErrors.projectDetails && (
                                        <p className="text-sm text-red-600">{fieldErrors.projectDetails}</p>
                                    )}
                                </div>

                                <div className="space-y-2 p-4 sm:p-6 bg-gray-50 rounded-[1.25rem] sm:rounded-[1.5rem] border border-gray-100">
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2 mb-4">
                                        <div>
                                            <label className="text-sm font-bold text-gray-700">Ideal budget expectation (Optional)</label>
                                            <p className="text-xs text-gray-500 mt-1">Totally flexible, we have multiple different price options to suit you and your budget.</p>
                                        </div>
                                        <div className="font-mono text-gray-900 font-bold bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">
                                            ${budget.toLocaleString()}+
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="500"
                                        max="50000"
                                        step="500"
                                        value={budget}
                                        onChange={(e) => setBudget(Number(e.target.value))}
                                        className="w-full accent-primary h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs font-mono text-gray-400 mt-2">
                                        <span>$500</span>
                                        <span>$50k+</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">What would you want to get out of this phone call? (Optional)</label>
                                    <textarea
                                        rows={2}
                                        name="callGoal"
                                        value={formValues.callGoal}
                                        onChange={handleFieldChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                                        placeholder="E.g. I mainly want to discuss timeline and paint options."
                                    ></textarea>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Upload pictures of the work (Optional)</label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/png,image/jpeg,image/webp,image/heif,image/heic"
                                        multiple
                                        onChange={handleFileInputChange}
                                    />
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer group ${isDraggingFiles ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setIsDraggingFiles(true);
                                        }}
                                        onDragLeave={() => setIsDraggingFiles(false)}
                                        onDrop={handleFileDrop}
                                    >
                                        <UploadCloud className="mx-auto text-gray-400 group-hover:text-primary transition-colors mb-2" size={28} />
                                        <p className="text-sm text-gray-500 font-medium">Click to upload or drag and drop</p>
                                        <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                                    </div>
                                    {uploadError && (
                                        <p className="text-sm text-red-600">{uploadError}</p>
                                    )}
                                    {uploadedImages.length > 0 && (
                                        <div className="space-y-2">
                                            {uploadedImages.map((file, index) => (
                                                <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-gray-800">{file.name}</p>
                                                        <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeUploadedFile(index)}
                                                        className="text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {submitError && (
                                    <p className="text-sm text-red-600">{submitError}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full btn-magnetic py-5 rounded-full font-bold text-xl mt-6 flex items-center justify-center gap-2 group shadow-[0_4px_20px_rgba(230,59,46,0.3)] ${isSubmitting ? 'bg-primary/70 text-white cursor-not-allowed' : 'bg-primary text-white'}`}
                                >
                                    <span className="bg-layer bg-black rounded-full text-white"></span>
                                    <span className="content-layer flex items-center gap-2 group-hover:text-white">
                                        {isSubmitting ? (
                                            <>
                                                Sending...
                                                <Loader2 size={22} className="animate-spin" />
                                            </>
                                        ) : (
                                            <>
                                                Continue to Booking <ChevronRight size={24} />
                                            </>
                                        )}
                                    </span>
                                </button>
                            </form>
                        </div>
                    )}

                    {step === 'calendar' && (
                        <div className="space-y-6 sm:space-y-8 font-body">
                            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                                <button
                                    onClick={() => setStep('form')}
                                    className="text-gray-400 hover:text-gray-800 transition-colors text-sm sm:text-base"
                                >
                                    Back
                                </button>
                                <div className="h-4 w-[1px] bg-gray-200"></div>
                                <span className="text-xs sm:text-sm font-bold text-primary uppercase tracking-widest">Step 2 of 2</span>
                            </div>

                            <div className="pr-8">
                                <h2 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">Select a Time</h2>
                                <p className="text-gray-500 mt-2 text-sm sm:text-base">
                                    15-Minute Consultation with <span className="font-bold text-gray-800">Carter Jenkins</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Availability syncs directly with Carter&apos;s calendar.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                                <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-100">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-gray-800">{calendarMonthLabel}</h3>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={goToPreviousMonth}
                                                disabled={!canGoToPreviousMonth || isLoadingAvailability}
                                                className={`p-1 rounded bg-white border border-gray-200 ${canGoToPreviousMonth && !isLoadingAvailability
                                                    ? 'text-gray-500 hover:text-gray-900'
                                                    : 'text-gray-300 cursor-not-allowed'
                                                    }`}
                                                aria-label="Previous month"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={goToNextMonth}
                                                disabled={isLoadingAvailability}
                                                className={`p-1 rounded bg-white border border-gray-200 ${isLoadingAvailability
                                                    ? 'text-gray-300 cursor-not-allowed'
                                                    : 'text-gray-500 hover:text-gray-900'
                                                    }`}
                                                aria-label="Next month"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-2">
                                        {WEEKDAY_LABELS.map((weekday) => (
                                            <div key={weekday}>{weekday}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-sm">
                                        {calendarCells.map((cell) => {
                                            if (!cell.dateKey || !cell.dayNumber) {
                                                return <div key={cell.key} className="aspect-square" />;
                                            }

                                            const isSelected = selectedDate === cell.dateKey;
                                            const interactive = cell.hasAvailability && !isLoadingAvailability;

                                            return (
                                                <button
                                                    key={cell.key}
                                                    type="button"
                                                    onClick={() => handleDateSelection(cell.dateKey!)}
                                                    disabled={!interactive}
                                                    className={`p-2 rounded-lg aspect-square flex items-center justify-center transition-all ${isSelected
                                                        ? 'bg-primary text-white font-bold shadow-md'
                                                        : interactive
                                                            ? 'text-gray-800 font-bold hover:bg-gray-200 hover:text-primary'
                                                            : 'text-gray-300 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {cell.dayNumber}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-4">
                                        Gray dates are unavailable. Time zone: <span className="font-semibold text-gray-600">{calendarTimezone}</span>
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3 max-h-[250px] sm:h-[320px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                                    <h3 className="font-bold text-gray-800 mb-2">{selectedDateLabel}</h3>

                                    {isLoadingAvailability && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Loader2 size={16} className="animate-spin" />
                                            Loading available times...
                                        </div>
                                    )}

                                    {!isLoadingAvailability && availabilityError && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-red-600">{availabilityError}</p>
                                            <button
                                                type="button"
                                                onClick={() => void loadCalendarAvailability()}
                                                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                                            >
                                                Retry availability sync
                                            </button>
                                        </div>
                                    )}

                                    {!isLoadingAvailability && !availabilityError && !selectedDate && (
                                        <p className="text-sm text-gray-500">No available days this month. Try the next month.</p>
                                    )}

                                    {!isLoadingAvailability && !availabilityError && selectedDate && selectedDateSlots.length === 0 && (
                                        <p className="text-sm text-gray-500">No times left on this day.</p>
                                    )}

                                    {!isLoadingAvailability && !availabilityError && selectedDateSlots.map((slot) => (
                                        <button
                                            key={slot.startIso}
                                            type="button"
                                            onClick={() => {
                                                setSelectedTime(slot.startIso);
                                                setBookingError('');
                                            }}
                                            className={`w-full p-4 border rounded-xl transition-all flex justify-between items-center group ${selectedTime === slot.startIso
                                                ? 'bg-primary border-primary text-white'
                                                : 'border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold'
                                                }`}
                                        >
                                            <span>{slot.label}</span>
                                            {selectedTime === slot.startIso ? (
                                                <CheckCircle2 size={18} className="text-white shrink-0" />
                                            ) : (
                                                <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {bookingError && (
                                <p className="text-sm text-red-600">{bookingError}</p>
                            )}

                            <button
                                onClick={() => void handleBookingSelect()}
                                disabled={!selectedTime || isBooking || isLoadingAvailability}
                                className={`w-full py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all ${(selectedTime && !isBooking && !isLoadingAvailability)
                                    ? 'bg-black text-white hover:bg-gray-900 shadow-md hover:shadow-lg focus:ring-4 focus:ring-gray-200'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {isBooking ? (
                                    <>
                                        Booking...
                                        <Loader2 size={18} className="animate-spin" />
                                    </>
                                ) : (
                                    'Book Phone Call'
                                )}
                            </button>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-12 flex flex-col items-center text-center font-body space-y-6">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 size={40} />
                            </div>
                            <h2 className="text-4xl font-heading font-bold text-gray-900">Call Scheduled.</h2>
                            <p className="text-gray-500 max-w-md">
                                You&apos;re all set. We&apos;ve sent confirmation emails, and if calendar invites are enabled, you&apos;ll also receive one for your booked time.
                            </p>
                            {confirmedBooking?.reminderLabels && confirmedBooking.reminderLabels.length > 0 && (
                                <p className="text-sm text-gray-500 max-w-md">
                                    Reminder notifications are scheduled for {confirmedBooking.reminderLabels.join(' and ')}.
                                </p>
                            )}
                            {confirmedBooking?.manageLink && (
                                <p className="text-sm text-gray-500 max-w-md">
                                    Need to change this call later? Use your&nbsp;
                                    <a
                                        href={confirmedBooking.manageLink}
                                        className="font-semibold text-primary hover:text-primary/80 transition-colors underline decoration-2 underline-offset-2"
                                    >
                                        manage booking link
                                    </a>
                                    .
                                </p>
                            )}

                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-3 w-full max-w-sm mt-8">
                                <div className="flex items-center gap-2 text-gray-800 font-bold">
                                    <CalendarIcon size={18} className="text-primary" /> {confirmedBooking?.displayDate || 'Date confirmed via email'}
                                </div>
                                <div className="flex items-center gap-2 text-gray-800 font-bold">
                                    <Clock size={18} className="text-primary" /> {confirmedBooking?.displayTime || 'Time confirmed via email'}
                                </div>
                            </div>

                            <button
                                onClick={handleClose}
                                className="mt-8 hover:text-primary font-bold transition-colors underline decoration-2 underline-offset-4"
                            >
                                Return to website
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuoteModal;
