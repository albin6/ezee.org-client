export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TicketEscalationTimingInfo {
  isApplicable: boolean;
  referenceStartAt: string | null;
  extendedMinutes: number;
  effectiveThresholdMinutes: number;
  effectiveThresholdMs: number;
  thresholdMs: number;
  activeElapsedMs: number;
  remainingActiveMs: number;
  remainingMs: number;
  escalationDeadlineAt: string | null;
  deadlineAt: string | null;
  isEscalationPaused: boolean;
  isPaused: boolean;
  isOverdue: boolean;
  formattedRemaining: string;
  shortRemaining: string;
}

export const DEFAULT_ESCALATION_TIMEZONE = 'Asia/Kolkata';
export const BASE_ESCALATION_HOURS = 2;

export function getZonedParts(
  date: Date,
  timeZone: string = DEFAULT_ESCALATION_TIMEZONE
): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = parseInt(p.value, 10);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: (map.hour || 0) % 24,
    minute: map.minute || 0,
    second: map.second || 0,
  };
}

export function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
  timeZone: string = DEFAULT_ESCALATION_TIMEZONE
): Date {
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = d.toLocaleString('en-US', { timeZone });
  const offset = new Date(tzStr).getTime() - new Date(utcStr).getTime();
  return new Date(d.getTime() - offset);
}

export function formatZonedDateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isSundayDate(year: number, month: number, day: number): boolean {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function toHolidaySet(holidayDates?: Iterable<string> | Set<string>): Set<string> | undefined {
  if (!holidayDates) return undefined;
  return holidayDates instanceof Set ? holidayDates : new Set(holidayDates);
}

export function isSundayOrHoliday(
  year: number,
  month: number,
  day: number,
  holidayDates?: Iterable<string> | Set<string>
): boolean {
  if (isSundayDate(year, month, day)) {
    return true;
  }
  if (!holidayDates) {
    return false;
  }
  const dateStr = formatZonedDateString(year, month, day);
  const set = toHolidaySet(holidayDates);
  return Boolean(set?.has(dateStr));
}

export function isEscalationActive(
  date: Date = new Date(),
  timeZone: string = DEFAULT_ESCALATION_TIMEZONE,
  holidayDates?: Iterable<string> | Set<string>
): boolean {
  const parts = getZonedParts(date, timeZone);
  if (isSundayOrHoliday(parts.year, parts.month, parts.day, holidayDates)) {
    return false;
  }
  const minutesFromMidnight = parts.hour * 60 + parts.minute;
  // 10:30 AM = 630 mins, 6:30 PM = 1110 mins
  return minutesFromMidnight >= 630 && minutesFromMidnight < 1110;
}

export function calculateActiveEscalationMs(
  start: Date,
  end: Date,
  timeZone: string = DEFAULT_ESCALATION_TIMEZONE,
  holidayDates?: Iterable<string> | Set<string>
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (endMs <= startMs) return 0;

  let totalActiveMs = 0;
  const startParts = getZonedParts(start, timeZone);
  const endParts = getZonedParts(end, timeZone);
  const holidaySet = toHolidaySet(holidayDates);

  let currentDayUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endDayUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

  while (currentDayUtc <= endDayUtc) {
    const curDate = new Date(currentDayUtc);
    const y = curDate.getUTCFullYear();
    const m = curDate.getUTCMonth() + 1;
    const d = curDate.getUTCDate();

    if (!isSundayOrHoliday(y, m, d, holidaySet)) {
      const windowStart = zonedDateToUtc(y, m, d, 10, 30, 0, timeZone).getTime();
      const windowEnd = zonedDateToUtc(y, m, d, 18, 30, 0, timeZone).getTime();

      const overlapStart = Math.max(startMs, windowStart);
      const overlapEnd = Math.min(endMs, windowEnd);

      if (overlapEnd > overlapStart) {
        totalActiveMs += overlapEnd - overlapStart;
      }
    }

    currentDayUtc += 24 * 60 * 60 * 1000;
  }

  return totalActiveMs;
}

export function calculateEscalationDueTime(
  start: Date,
  activeHoursRequired: number = BASE_ESCALATION_HOURS,
  timeZone: string = DEFAULT_ESCALATION_TIMEZONE,
  holidayDates?: Iterable<string> | Set<string>
): Date {
  let remainingMsNeeded = activeHoursRequired * 60 * 60 * 1000;
  const startParts = getZonedParts(start, timeZone);
  const holidaySet = toHolidaySet(holidayDates);
  let currentDayUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  let daysChecked = 0;

  while (remainingMsNeeded > 0 && daysChecked < 3660) {
    const curDate = new Date(currentDayUtc);
    const y = curDate.getUTCFullYear();
    const m = curDate.getUTCMonth() + 1;
    const d = curDate.getUTCDate();

    if (!isSundayOrHoliday(y, m, d, holidaySet)) {
      const windowStart = zonedDateToUtc(y, m, d, 10, 30, 0, timeZone).getTime();
      const windowEnd = zonedDateToUtc(y, m, d, 18, 30, 0, timeZone).getTime();

      const effectiveStart = Math.max(start.getTime(), windowStart);

      if (effectiveStart < windowEnd) {
        const availableMsToday = windowEnd - effectiveStart;
        if (remainingMsNeeded <= availableMsToday) {
          return new Date(effectiveStart + remainingMsNeeded);
        }
        remainingMsNeeded -= availableMsToday;
      }
    }

    currentDayUtc += 24 * 60 * 60 * 1000;
    daysChecked++;
  }

  return new Date();
}

export function getTicketEscalationReferenceTime(ticket: {
  status?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  inProgressAt?: Date | string | null;
  lastEscalatedAt?: Date | string | null;
}): Date | null {
  if (!ticket || (ticket.status !== 'OPEN' && ticket.status !== 'IN_PROGRESS')) {
    return null;
  }

  if (ticket.status === 'OPEN') {
    const raw = ticket.lastEscalatedAt || ticket.createdAt;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = ticket.lastEscalatedAt || ticket.inProgressAt || ticket.updatedAt || ticket.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatActiveDurationMs(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export function computeTicketEscalationTiming(
  ticket: {
    status?: string | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
    inProgressAt?: Date | string | null;
    lastEscalatedAt?: Date | string | null;
    escalationExtendedMinutes?: number | null;
  } | null | undefined,
  now: Date = new Date(),
  timeZone: string = DEFAULT_ESCALATION_TIMEZONE,
  holidayDates?: Iterable<string> | Set<string>,
  baseEscalationHours: number = BASE_ESCALATION_HOURS
): TicketEscalationTimingInfo {
  const extendedMinutes = Math.max(0, Number(ticket?.escalationExtendedMinutes) || 0);
  const baseMinutes = Math.round(baseEscalationHours * 60);
  const effectiveThresholdMinutes = baseMinutes + extendedMinutes;
  const effectiveThresholdMs = effectiveThresholdMinutes * 60 * 1000;

  if (!ticket) {
    return {
      isApplicable: false,
      referenceStartAt: null,
      extendedMinutes,
      effectiveThresholdMinutes,
      effectiveThresholdMs,
      thresholdMs: effectiveThresholdMs,
      activeElapsedMs: 0,
      remainingActiveMs: 0,
      remainingMs: 0,
      escalationDeadlineAt: null,
      deadlineAt: null,
      isEscalationPaused: false,
      isPaused: false,
      isOverdue: false,
      formattedRemaining: '',
      shortRemaining: '',
    };
  }

  const refTime = getTicketEscalationReferenceTime(ticket);
  if (!refTime) {
    return {
      isApplicable: false,
      referenceStartAt: null,
      extendedMinutes,
      effectiveThresholdMinutes,
      effectiveThresholdMs,
      thresholdMs: effectiveThresholdMs,
      activeElapsedMs: 0,
      remainingActiveMs: 0,
      remainingMs: 0,
      escalationDeadlineAt: null,
      deadlineAt: null,
      isEscalationPaused: false,
      isPaused: false,
      isOverdue: false,
      formattedRemaining: '',
      shortRemaining: '',
    };
  }

  const holidaySet = toHolidaySet(holidayDates);
  const activeElapsedMs = calculateActiveEscalationMs(refTime, now, timeZone, holidaySet);
  const remainingActiveMs = Math.max(0, effectiveThresholdMs - activeElapsedMs);
  const dueDate = calculateEscalationDueTime(
    refTime,
    effectiveThresholdMinutes / 60,
    timeZone,
    holidaySet
  );
  const isEscalationPaused = !isEscalationActive(now, timeZone, holidaySet);
  const isOverdue = activeElapsedMs >= effectiveThresholdMs;

  const durationText = formatActiveDurationMs(remainingActiveMs);
  let formattedRemaining = '';
  let shortRemaining = '';

  if (isOverdue) {
    formattedRemaining = isEscalationPaused
      ? 'Escalation due (Paused)'
      : 'Escalation due';
    shortRemaining = isEscalationPaused ? 'Due (Paused)' : 'Escalation due';
  } else {
    formattedRemaining = isEscalationPaused
      ? `${durationText} remaining (Paused)`
      : `${durationText} remaining`;
    shortRemaining = isEscalationPaused
      ? `${durationText} (Paused)`
      : `${durationText} left`;
  }

  const deadlineIso = dueDate.toISOString();

  return {
    isApplicable: true,
    referenceStartAt: refTime.toISOString(),
    extendedMinutes,
    effectiveThresholdMinutes,
    effectiveThresholdMs,
    thresholdMs: effectiveThresholdMs,
    activeElapsedMs,
    remainingActiveMs,
    remainingMs: remainingActiveMs,
    escalationDeadlineAt: deadlineIso,
    deadlineAt: deadlineIso,
    isEscalationPaused,
    isPaused: isEscalationPaused,
    isOverdue,
    formattedRemaining,
    shortRemaining,
  };
}

/**
 * Checks whether the current user is authorized to extend the escalation time of a ticket.
 * Per requirements, only the ticket's current Assignee(s) or Assignor (creator) may extend escalation time.
 */
export function canUserExtendTicketEscalation(
  ticket: {
    status?: string | null;
    createdById?: string | null;
    createdBy?: { id?: string | null } | null;
    assignees?: { userId?: string | null; user?: { id?: string | null } | null }[] | null;
  } | null | undefined,
  currentUserId?: string | null
): boolean {
  if (!ticket || !currentUserId) return false;
  if (ticket.status !== 'OPEN' && ticket.status !== 'IN_PROGRESS') return false;

  const creatorId = ticket.createdById || ticket.createdBy?.id;
  if (creatorId === currentUserId) return true;

  if (Array.isArray(ticket.assignees)) {
    return ticket.assignees.some((a) => (a?.userId || a?.user?.id) === currentUserId);
  }

  return false;
}
