import {
  ComputedDoseStatus,
  DailyAdherencePoint,
  DailyPeriod,
  DoseLog,
  Medication,
  MedicationAdherenceItem,
  ScheduledDose,
} from '../types/medication';

export const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseDateKey(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return getDateKey(dt);
}

export function formatDateHeading(dateKey: string, now: Date): string {
  const todayKey = getDateKey(now);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const tomorrowKey = shiftDateKey(todayKey, 1);

  const parsed = parseDateKey(dateKey);
  const formatted = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (dateKey === todayKey) return `Today · ${formatted}`;
  if (dateKey === yesterdayKey) return `Yesterday · ${formatted}`;
  if (dateKey === tomorrowKey) return `Tomorrow · ${formatted}`;
  return formatted;
}

export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getPeriodForTime(hhmm: string): DailyPeriod {
  const hour = Number(hhmm.split(':')[0]);
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Bedtime';
}

export function buildDoseLogId(medicationId: string, dateKey: string, scheduledTime: string): string {
  const cleanTime = scheduledTime.replace(':', '');
  return `${medicationId}_${dateKey}_${cleanTime}`;
}

export function isMedicationScheduledForDate(med: Medication, date: Date): boolean {
  if (!med.active) return false;
  if (med.frequencyType === 'daily') return true;
  const dayOfWeek = date.getDay();
  return med.daysOfWeek.includes(dayOfWeek);
}

export function getSlotDateTime(dateKey: string, scheduledTime: string): Date {
  const base = parseDateKey(dateKey);
  const [h, m] = scheduledTime.split(':').map(Number);
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

export function buildDailySchedule(
  medications: Medication[],
  doseLogs: DoseLog[],
  dateKey: string,
  now: Date,
  reminderLeadMinutes: number
): ScheduledDose[] {
  const targetDate = parseDateKey(dateKey);
  const logMap = new Map<string, DoseLog>();
  for (const log of doseLogs) {
    if (log.dateKey === dateKey) {
      logMap.set(buildDoseLogId(log.medicationId, log.dateKey, log.scheduledTime), log);
    }
  }

  const todayKey = getDateKey(now);
  const isPastDay = dateKey < todayKey;
  const isFutureDay = dateKey > todayKey;

  const slots: ScheduledDose[] = [];

  for (const med of medications) {
    if (!isMedicationScheduledForDate(med, targetDate)) continue;

    for (const scheduledTime of med.scheduleTimes) {
      const slotId = buildDoseLogId(med.id, dateKey, scheduledTime);
      const log = logMap.get(slotId);
      const slotDate = getSlotDateTime(dateKey, scheduledTime);
      const minutesDelta = Math.round((now.getTime() - slotDate.getTime()) / 60000);

      let status: ComputedDoseStatus;

      if (log?.status === 'taken') {
        status = 'taken';
      } else if (log?.status === 'skipped') {
        status = 'skipped';
      } else if (log?.status === 'snoozed') {
        const snoozeTime = log.snoozedUntil ? new Date(log.snoozedUntil).getTime() : 0;
        if (snoozeTime > now.getTime()) {
          status = 'snoozed';
        } else {
          status = 'due';
        }
      } else if (isFutureDay) {
        status = 'upcoming';
      } else if (isPastDay) {
        status = 'overdue';
      } else {
        // Today
        if (minutesDelta > 30) {
          status = 'overdue';
        } else if (minutesDelta >= -Math.max(0, reminderLeadMinutes)) {
          status = 'due';
        } else {
          status = 'upcoming';
        }
      }

      slots.push({
        slotId,
        medication: med,
        dateKey,
        scheduledTime,
        period: getPeriodForTime(scheduledTime),
        status,
        log,
        minutesDelta,
      });
    }
  }

  slots.sort((a, b) => {
    if (a.scheduledTime !== b.scheduledTime) {
      return a.scheduledTime.localeCompare(b.scheduledTime);
    }
    return a.medication.name.localeCompare(b.medication.name);
  });

  return slots;
}

export function calculateAdherenceSeries(
  medications: Medication[],
  doseLogs: DoseLog[],
  daysCount: number,
  now: Date
): {
  series: DailyAdherencePoint[];
  overallRate: number | null;
  totalScheduled: number;
  totalTaken: number;
  byMedication: MedicationAdherenceItem[];
} {
  const todayKey = getDateKey(now);
  const series: DailyAdherencePoint[] = [];
  const medTotals = new Map<string, { scheduled: number; taken: number }>();

  for (const med of medications) {
    medTotals.set(med.id, { scheduled: 0, taken: 0 });
  }

  let totalScheduled = 0;
  let totalTaken = 0;

  for (let offset = daysCount - 1; offset >= 0; offset--) {
    const dateKey = shiftDateKey(todayKey, -offset);
    const d = parseDateKey(dateKey);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const slots = buildDailySchedule(medications, doseLogs, dateKey, now, 0);

    // For today, only count doses that are taken, skipped, or already past/due so future doses don't penalize today's adherence prematurely
    const countableSlots =
      dateKey === todayKey
        ? slots.filter((s) => s.status !== 'upcoming')
        : slots;

    let dayTaken = 0;
    let daySkipped = 0;
    for (const s of countableSlots) {
      const entry = medTotals.get(s.medication.id);
      if (entry) entry.scheduled += 1;

      if (s.status === 'taken') {
        dayTaken += 1;
        if (entry) entry.taken += 1;
      } else if (s.status === 'skipped') {
        daySkipped += 1;
      }
    }

    const scheduled = countableSlots.length;
    totalScheduled += scheduled;
    totalTaken += dayTaken;

    series.push({
      dateKey,
      label,
      scheduled,
      taken: dayTaken,
      skipped: daySkipped,
      rate: scheduled > 0 ? Math.round((dayTaken / scheduled) * 100) : null,
    });
  }

  const byMedication: MedicationAdherenceItem[] = medications.map((med) => {
    const t = medTotals.get(med.id) || { scheduled: 0, taken: 0 };
    return {
      medicationId: med.id,
      name: med.name,
      dosage: med.dosage,
      scheduledCount: t.scheduled,
      takenCount: t.taken,
      rate: t.scheduled > 0 ? Math.round((t.taken / t.scheduled) * 100) : null,
    };
  });

  return {
    series,
    overallRate: totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : null,
    totalScheduled,
    totalTaken,
    byMedication,
  };
}

export function playGentleChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25]; // C5 -> E5 calm clinical interval
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);

      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.48);
    });

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Ignore audio context autoplay restriction errors
  }
}
