import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RotateCcw,
  SkipForward,
  Timer,
} from 'lucide-react';
import {
  buildDailySchedule,
  calculateAdherenceSeries,
  formatDateHeading,
  formatTime12h,
  getDateKey,
  shiftDateKey,
} from '../lib/schedule';
import {
  DailyPeriod,
  DoseActionStatus,
  DoseLog,
  Medication,
  ScheduledDose,
} from '../types/medication';

interface TodayTimelineViewProps {
  medications: Medication[];
  doseLogs: DoseLog[];
  loading: boolean;
  now: Date;
  reminderLeadMinutes: number;
  snoozeDefaultMinutes: number;
  onLogDose: (params: {
    medication: Medication;
    dateKey: string;
    scheduledTime: string;
    status: DoseActionStatus;
    snoozeMinutes?: number;
    notes?: string;
  }) => Promise<void>;
  onResetDose: (medication: Medication, dateKey: string, scheduledTime: string) => Promise<void>;
  onAddMedication: () => void;
}

const PERIOD_ORDER: DailyPeriod[] = ['Morning', 'Afternoon', 'Evening', 'Bedtime'];

function StatusIndicator({ slot }: { slot: ScheduledDose }) {
  if (slot.status === 'taken') {
    const takenTime = slot.log?.takenAt
      ? new Date(slot.log.takenAt).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Taken{takenTime ? ` at ${takenTime}` : ''}</span>
      </span>
    );
  }
  if (slot.status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
        <SkipForward className="w-3.5 h-3.5 shrink-0" />
        <span>Skipped</span>
      </span>
    );
  }
  if (slot.status === 'snoozed') {
    const until = slot.log?.snoozedUntil
      ? new Date(slot.log.snoozedUntil).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <Timer className="w-3.5 h-3.5 shrink-0" />
        <span>Snoozed{until ? ` until ${until}` : ''}</span>
      </span>
    );
  }
  if (slot.status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Overdue</span>
      </span>
    );
  }
  if (slot.status === 'due') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Due now</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Scheduled</span>
    </span>
  );
}

export function TodayTimelineView({
  medications,
  doseLogs,
  loading,
  now,
  reminderLeadMinutes,
  snoozeDefaultMinutes,
  onLogDose,
  onResetDose,
  onAddMedication,
}: TodayTimelineViewProps) {
  const todayKey = getDateKey(now);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [filterMode, setFilterMode] = useState<'all' | 'remaining' | 'completed'>('all');
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  const slots = useMemo(
    () =>
      buildDailySchedule(
        medications,
        doseLogs,
        selectedDateKey,
        now,
        reminderLeadMinutes
      ),
    [medications, doseLogs, selectedDateKey, now, reminderLeadMinutes]
  );

  const todaySlots = useMemo(
    () =>
      selectedDateKey === todayKey
        ? slots
        : buildDailySchedule(medications, doseLogs, todayKey, now, reminderLeadMinutes),
    [selectedDateKey, todayKey, slots, medications, doseLogs, now, reminderLeadMinutes]
  );

  const adherence7d = useMemo(
    () => calculateAdherenceSeries(medications, doseLogs, 7, now),
    [medications, doseLogs, now]
  );

  const filteredSlots = useMemo(() => {
    if (filterMode === 'remaining') {
      return slots.filter((s) => s.status !== 'taken' && s.status !== 'skipped');
    }
    if (filterMode === 'completed') {
      return slots.filter((s) => s.status === 'taken' || s.status === 'skipped');
    }
    return slots;
  }, [slots, filterMode]);

  const groupedByPeriod = useMemo(() => {
    const map = new Map<DailyPeriod, ScheduledDose[]>();
    for (const p of PERIOD_ORDER) map.set(p, []);
    for (const slot of filteredSlots) {
      map.get(slot.period)?.push(slot);
    }
    return PERIOD_ORDER.map((period) => ({
      period,
      items: map.get(period) || [],
    })).filter((g) => g.items.length > 0);
  }, [filteredSlots]);

  const todayTaken = todaySlots.filter((s) => s.status === 'taken').length;
  const todayTotal = todaySlots.length;
  const progressPct = todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 0;

  const nextDose = todaySlots.find(
    (s) => s.status === 'due' || s.status === 'overdue' || s.status === 'upcoming' || s.status === 'snoozed'
  );

  const lowSupplyMeds = medications.filter(
    (m) => m.active && m.trackSupply && m.remainingQuantity <= m.refillThreshold
  );

  const handleAction = async (
    slot: ScheduledDose,
    status: DoseActionStatus
  ) => {
    setBusySlotId(slot.slotId);
    try {
      await onLogDose({
        medication: slot.medication,
        dateKey: slot.dateKey,
        scheduledTime: slot.scheduledTime,
        status,
        snoozeMinutes: snoozeDefaultMinutes,
      });
    } finally {
      setBusySlotId(null);
    }
  };

  const handleUndo = async (slot: ScheduledDose) => {
    setBusySlotId(slot.slotId);
    try {
      await onResetDose(slot.medication, slot.dateKey, slot.scheduledTime);
    } finally {
      setBusySlotId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl p-4 animate-pulse" />
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 p-4 animate-pulse bg-slate-50/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-Column Summary Strip */}
      <section aria-label="Daily overview" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Today's Doses</div>
          <div className="flex items-baseline justify-between gap-2 mb-2.5">
            <span className="font-display text-2xl font-semibold text-slate-900 tabular-nums">
              {todayTaken} of {todayTotal}
            </span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-700 transition-[width] duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Next Scheduled Dose</div>
          {nextDose ? (
            <>
              <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums truncate">
                {formatTime12h(nextDose.scheduledTime)}
              </div>
              <div className="text-xs text-slate-600 truncate mt-0.5">
                {nextDose.medication.name} · {nextDose.medication.dosage}
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-lg font-semibold text-slate-900">
                {todayTotal > 0 ? 'All caught up' : 'No doses today'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {todayTotal > 0 ? 'Every dose logged for today' : 'Add a medication to start'}
              </div>
            </>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">7-Day Adherence</div>
          <div className="font-display text-2xl font-semibold text-slate-900 tabular-nums">
            {adherence7d.overallRate !== null ? `${adherence7d.overallRate}%` : '—'}
          </div>
          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
            {adherence7d.totalScheduled > 0
              ? `${adherence7d.totalTaken} of ${adherence7d.totalScheduled} doses taken`
              : 'Builds automatically as you log'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Supply & Refills</div>
          {lowSupplyMeds.length > 0 ? (
            <>
              <div className="font-display text-lg font-semibold text-amber-700 tabular-nums">
                {lowSupplyMeds.length} low {lowSupplyMeds.length === 1 ? 'refill' : 'refills'}
              </div>
              <div className="text-xs text-slate-600 truncate mt-0.5">
                {lowSupplyMeds.map((m) => m.name).join(', ')}
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-lg font-semibold text-green-700">
                Stocked
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                No medications below refill threshold
              </div>
            </>
          )}
        </div>
      </section>

      {/* Date Navigation & Filter Toolbar */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setSelectedDateKey((d) => shiftDateKey(d, -1))}
              aria-label="Previous day"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-medium text-slate-900 whitespace-nowrap">
              {formatDateHeading(selectedDateKey, now)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDateKey((d) => shiftDateKey(d, 1))}
              aria-label="Next day"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDateKey !== todayKey && (
            <button
              type="button"
              onClick={() => setSelectedDateKey(todayKey)}
              className="px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Jump to Today
            </button>
          )}

          <label className="relative inline-flex items-center cursor-pointer">
            <Calendar className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="date"
              aria-label="Select schedule date"
              value={selectedDateKey}
              onChange={(e) => {
                if (e.target.value) setSelectedDateKey(e.target.value);
              }}
              className="pl-9 pr-3 py-1.5 text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </label>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All Doses' },
              { id: 'remaining', label: 'Remaining' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filterMode === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Dose Timeline */}
      {medications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">
            No medications scheduled yet
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Add your daily prescriptions, vitamins, or supplements with their scheduled times to
            activate your timeline and daily dose reminders.
          </p>
          <button
            type="button"
            onClick={onAddMedication}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add First Medication
          </button>
        </div>
      ) : groupedByPeriod.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-slate-900 mb-1">
            No doses match this view
          </p>
          <p className="text-xs text-slate-500 mb-4">
            {filterMode !== 'all'
              ? 'Switch the filter back to All Doses to see the full daily schedule.'
              : 'No active medications are scheduled for this day of the week.'}
          </p>
          {filterMode !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Show All Doses
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByPeriod.map(({ period, items }) => (
            <section
              key={period}
              aria-label={`${period} doses`}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-slate-900">{period}</h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {items.length} {items.length === 1 ? 'dose' : 'doses'}
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {items.map((slot) => {
                  const isBusy = busySlotId === slot.slotId;
                  const isLogged = slot.status === 'taken' || slot.status === 'skipped';
                  const isLowSupply =
                    slot.medication.trackSupply &&
                    slot.medication.remainingQuantity <= slot.medication.refillThreshold;

                  return (
                    <div
                      key={slot.slotId}
                      className="px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-20 shrink-0 pt-0.5">
                          <span className="font-mono text-sm font-medium text-slate-900 tabular-nums">
                            {formatTime12h(slot.scheduledTime)}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold ${
                                slot.status === 'taken'
                                  ? 'text-slate-500 line-through'
                                  : 'text-slate-900'
                              }`}
                            >
                              {slot.medication.name}
                            </span>
                            <span className="text-xs text-slate-600 tabular-nums">
                              {slot.medication.dosage}
                            </span>
                            <span className="text-xs text-slate-400" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs text-slate-500">{slot.medication.form}</span>
                            {isLowSupply && (
                              <>
                                <span className="text-xs text-slate-400" aria-hidden="true">
                                  ·
                                </span>
                                <span className="text-xs font-medium text-amber-700 tabular-nums">
                                  {slot.medication.remainingQuantity} left
                                </span>
                              </>
                            )}
                          </div>

                          {slot.medication.instructions && (
                            <p className="text-xs text-slate-500 mt-1 truncate">
                              {slot.medication.instructions}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pl-24 lg:pl-0">
                        <StatusIndicator slot={slot} />

                        <div className="flex items-center gap-2 shrink-0">
                          {isLogged ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUndo(slot)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Undo
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(slot, 'taken')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Mark Taken
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(slot, 'snoozed')}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Timer className="w-3.5 h-3.5" />
                                Snooze {snoozeDefaultMinutes}m
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(slot, 'skipped')}
                                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Skip
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
