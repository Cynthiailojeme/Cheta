import { useMemo, useState } from 'react';
import { CheckCircle2, SkipForward, Timer } from 'lucide-react';
import { calculateAdherenceSeries, formatTime12h } from '../lib/schedule';
import { DoseLog, Medication } from '../types/medication';

interface HistoryViewProps {
  medications: Medication[];
  doseLogs: DoseLog[];
  loading: boolean;
  now: Date;
}

export function HistoryView({ medications, doseLogs, loading, now }: HistoryViewProps) {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);

  const stats = useMemo(
    () => calculateAdherenceSeries(medications, doseLogs, rangeDays, now),
    [medications, doseLogs, rangeDays, now]
  );

  const recentLogs = useMemo(() => {
    const copy = [...doseLogs];
    copy.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
      return b.scheduledTime.localeCompare(a.scheduledTime);
    });
    return copy.slice(0, 40);
  }, [doseLogs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Adherence Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily completion percentage calculated from your scheduled doses and logged actions
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
          {([7, 14, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                rangeDays === days
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Daily Adherence Bar Chart */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <span className="text-xs text-slate-500 block">Period Adherence Rate</span>
            <span className="font-display text-3xl font-semibold text-slate-900 tabular-nums">
              {stats.overallRate !== null ? `${stats.overallRate}%` : '—'}
            </span>
          </div>
          <div className="text-xs text-slate-600 tabular-nums">
            <span className="font-mono font-medium text-slate-900">{stats.totalTaken}</span> taken of{' '}
            <span className="font-mono font-medium text-slate-900">{stats.totalScheduled}</span>{' '}
            scheduled doses
          </div>
        </div>

        {stats.totalScheduled === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No scheduled doses recorded in this date window yet.
          </p>
        ) : (
          <div className="grid gap-1.5 items-end h-40 pt-4" style={{ gridTemplateColumns: `repeat(${stats.series.length}, minmax(0, 1fr))` }}>
            {stats.series.map((pt) => {
              const heightPct = pt.rate === null ? 6 : Math.max(8, pt.rate);
              const barColor =
                pt.rate === null
                  ? 'bg-slate-200'
                  : pt.rate >= 85
                  ? 'bg-teal-700'
                  : pt.rate >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500';

              return (
                <div
                  key={pt.dateKey}
                  className="flex flex-col items-center justify-end h-full group"
                  title={`${pt.label}: ${pt.rate !== null ? `${pt.rate}% (${pt.taken}/${pt.scheduled})` : 'No doses'}`}
                >
                  <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums">
                    {pt.rate !== null ? `${pt.rate}%` : '—'}
                  </span>
                  <div
                    className={`w-full max-w-[28px] rounded-t transition-all ${barColor}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-slate-500 mt-2 truncate max-w-full">
                    {rangeDays <= 14 ? pt.label.split(' ')[1] : pt.dateKey.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Per-Medication Breakdown + Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              By Medication ({rangeDays} Days)
            </h3>
          </div>
          {stats.byMedication.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No medications added yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {stats.byMedication.map((item) => (
                <div key={item.medicationId} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {item.dosage} · {item.takenCount}/{item.scheduledCount} doses
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {item.rate !== null ? `${item.rate}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
            <h3 className="font-display text-sm font-semibold text-slate-900">Recent Dose Log</h3>
          </div>
          {recentLogs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              Your logged doses will appear here once you mark a dose taken, snoozed, or skipped.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-5">Date & Time</th>
                    <th className="py-2.5 px-4">Medication</th>
                    <th className="py-2.5 px-5 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {log.dateKey} · {formatTime12h(log.scheduledTime)}
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-medium">
                        {log.medicationName}{' '}
                        <span className="font-normal text-slate-500">· {log.dosage}</span>
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        {log.status === 'taken' && (
                          <span className="inline-flex items-center gap-1 font-medium text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Taken
                          </span>
                        )}
                        {log.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                            <SkipForward className="w-3.5 h-3.5" />
                            Skipped
                          </span>
                        )}
                        {log.status === 'snoozed' && (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <Timer className="w-3.5 h-3.5" />
                            Snoozed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
