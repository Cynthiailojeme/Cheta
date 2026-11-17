import React, { useEffect, useState } from 'react';
import { Clock, Plus, Trash2, X } from 'lucide-react';
import { DAY_LABELS_SHORT, getPeriodForTime } from '../lib/schedule';
import {
  FrequencyType,
  MEDICATION_FORMS,
  Medication,
  MedicationForm,
  MedicationInput,
  SCHEMA_LIMITS,
} from '../types/medication';

interface MedicationModalProps {
  open: boolean;
  editingMedication: Medication | null;
  onClose: () => void;
  onSave: (input: MedicationInput) => Promise<void>;
}

interface TimeSlotRow {
  uid: string;
  time: string; // 24h "HH:MM"
}

const SCHEDULE_PATTERNS: { label: string; times: string[] }[] = [
  { label: 'Once daily', times: ['08:00'] },
  { label: 'Twice daily', times: ['08:00', '20:00'] },
  { label: '3x daily', times: ['08:00', '14:00', '20:00'] },
  { label: 'Bedtime', times: ['21:30'] },
];

const HOURS_12 = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function to12HourParts(hhmm: string): { hour12: string; minute: string; meridiem: 'AM' | 'PM' } {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw) || 0;
  const m = Number(mRaw) || 0;
  const meridiem: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    hour12: String(h12).padStart(2, '0'),
    minute: String(m).padStart(2, '0'),
    meridiem,
  };
}

function to24HourString(hour12: string, minute: string, meridiem: 'AM' | 'PM'): string {
  const h12 = Number(hour12) || 12;
  let h24 = h12 % 12;
  if (meridiem === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

function makeSlotRow(time: string, idx: number): TimeSlotRow {
  return { uid: `slot_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`, time };
}

function suggestNextTime(existingTimes: string[]): string {
  const candidates = ['08:00', '20:00', '13:00', '21:30', '10:00', '16:00', '06:00', '22:30'];
  const next = candidates.find((c) => !existingTimes.includes(c));
  if (next) return next;
  for (let h = 7; h < 23; h++) {
    const val = `${String(h).padStart(2, '0')}:00`;
    if (!existingTimes.includes(val)) return val;
  }
  return '12:00';
}

export function MedicationModal({
  open,
  editingMedication,
  onClose,
  onSave,
}: MedicationModalProps) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicationForm>('Tablet');
  const [instructions, setInstructions] = useState('');
  const [slotRows, setSlotRows] = useState<TimeSlotRow[]>([makeSlotRow('08:00', 0)]);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [active, setActive] = useState(true);
  const [trackSupply, setTrackSupply] = useState(false);
  const [remainingQuantity, setRemainingQuantity] = useState('30');
  const [refillThreshold, setRefillThreshold] = useState('7');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (editingMedication) {
      setName(editingMedication.name);
      setDosage(editingMedication.dosage);
      setForm(editingMedication.form);
      setInstructions(editingMedication.instructions);
      const initialTimes =
        editingMedication.scheduleTimes.length > 0 ? editingMedication.scheduleTimes : ['08:00'];
      setSlotRows(initialTimes.map((t, i) => makeSlotRow(t, i)));
      setFrequencyType(editingMedication.frequencyType);
      setDaysOfWeek(
        editingMedication.daysOfWeek.length > 0
          ? editingMedication.daysOfWeek
          : [0, 1, 2, 3, 4, 5, 6]
      );
      setActive(editingMedication.active);
      setTrackSupply(editingMedication.trackSupply);
      setRemainingQuantity(String(editingMedication.remainingQuantity));
      setRefillThreshold(String(editingMedication.refillThreshold));
    } else {
      setName('');
      setDosage('');
      setForm('Tablet');
      setInstructions('');
      setSlotRows([makeSlotRow('08:00', 0)]);
      setFrequencyType('daily');
      setDaysOfWeek([1, 2, 3, 4, 5]);
      setActive(true);
      setTrackSupply(true);
      setRemainingQuantity('30');
      setRefillThreshold('7');
    }
  }, [open, editingMedication]);

  if (!open) return null;

  const applySchedulePattern = (times: string[]) => {
    setErrorMsg(null);
    setSlotRows(times.map((t, i) => makeSlotRow(t, i)));
  };

  const addScheduleSlot = () => {
    if (slotRows.length >= SCHEMA_LIMITS.MAX_SCHEDULE_TIMES) {
      setErrorMsg(`You can schedule up to ${SCHEMA_LIMITS.MAX_SCHEDULE_TIMES} daily doses per medication.`);
      return;
    }
    setErrorMsg(null);
    const nextTime = suggestNextTime(slotRows.map((r) => r.time));
    setSlotRows((prev) => [...prev, makeSlotRow(nextTime, prev.length)]);
  };

  const updateSlotTime = (uid: string, nextTime: string) => {
    setErrorMsg(null);
    setSlotRows((prev) => prev.map((row) => (row.uid === uid ? { ...row, time: nextTime } : row)));
  };

  const removeScheduleSlot = (uid: string) => {
    if (slotRows.length <= 1) {
      setErrorMsg('At least one daily dose time is required.');
      return;
    }
    setErrorMsg(null);
    setSlotRows((prev) => prev.filter((row) => row.uid !== uid));
  };

  const toggleDay = (dayIndex: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayIndex);
      }
      return [...prev, dayIndex].sort();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedDosage = dosage.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter a medication name.');
      return;
    }
    if (!trimmedDosage) {
      setErrorMsg('Please enter a dosage (for example, 10 mg or 1 tablet).');
      return;
    }

    const rawTimes = slotRows.map((r) => r.time);
    const uniqueTimes = Array.from(new Set(rawTimes)).sort();
    if (uniqueTimes.length !== rawTimes.length) {
      setErrorMsg('Each daily dose needs a distinct reminder time. Adjust or remove duplicates.');
      return;
    }
    if (uniqueTimes.length === 0) {
      setErrorMsg('Please include at least one dose time.');
      return;
    }
    if (frequencyType === 'specific_days' && daysOfWeek.length === 0) {
      setErrorMsg('Select at least one day of the week.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        id: editingMedication?.id,
        name: trimmedName,
        dosage: trimmedDosage,
        form,
        instructions: instructions.trim(),
        scheduleTimes: uniqueTimes,
        frequencyType,
        daysOfWeek: frequencyType === 'specific_days' ? daysOfWeek : [],
        active,
        trackSupply,
        remainingQuantity: Number(remainingQuantity) || 0,
        refillThreshold: Number(refillThreshold) || 0,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save medication.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="medication-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="medication-modal-title" className="font-display text-lg font-semibold text-slate-900">
            {editingMedication ? 'Edit Medication' : 'Add Medication'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="med-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Medication Name
              </label>
              <input
                id="med-name"
                type="text"
                required
                maxLength={SCHEMA_LIMITS.NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Lisinopril, Metformin, Vitamin D3"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <div>
              <label htmlFor="med-dosage" className="block text-xs font-medium text-slate-700 mb-1.5">
                Dosage
              </label>
              <input
                id="med-dosage"
                type="text"
                required
                maxLength={SCHEMA_LIMITS.DOSAGE_MAX}
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g., 10 mg, 500 mg, 1 puff"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <div>
              <label htmlFor="med-form" className="block text-xs font-medium text-slate-700 mb-1.5">
                Form
              </label>
              <select
                id="med-form"
                value={form}
                onChange={(e) => setForm(e.target.value as MedicationForm)}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
              >
                {MEDICATION_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="med-instructions" className="block text-xs font-medium text-slate-700 mb-1.5">
              Instructions (Optional)
            </label>
            <input
              id="med-instructions"
              type="text"
              maxLength={SCHEMA_LIMITS.INSTRUCTIONS_MAX}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Take with morning meal and a full glass of water"
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
            />
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="block text-xs font-medium text-slate-700">
                  Daily Reminder Times ({slotRows.length}/{SCHEMA_LIMITS.MAX_SCHEDULE_TIMES})
                </span>
                <span className="block text-[11px] text-slate-500">
                  Pick a quick pattern or customize each dose time directly below
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {SCHEDULE_PATTERNS.map((pattern) => {
                const currentSorted = [...slotRows.map((r) => r.time)].sort().join(',');
                const patternSorted = [...pattern.times].sort().join(',');
                const isActivePattern = currentSorted === patternSorted;
                return (
                  <button
                    key={pattern.label}
                    type="button"
                    onClick={() => applySchedulePattern(pattern.times)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      isActivePattern
                        ? 'bg-teal-50 border-teal-300 text-teal-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {pattern.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {slotRows.map((row, index) => {
                const { hour12, minute, meridiem } = to12HourParts(row.time);
                const period = getPeriodForTime(row.time);

                return (
                  <div
                    key={row.uid}
                    className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 whitespace-nowrap">
                        Dose {index + 1}
                      </span>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{period}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="inline-flex items-center bg-white border border-slate-300 rounded-lg px-1.5 py-1">
                        <select
                          aria-label={`Dose ${index + 1} hour`}
                          value={hour12}
                          onChange={(e) =>
                            updateSlotTime(
                              row.uid,
                              to24HourString(e.target.value, minute, meridiem)
                            )
                          }
                          className="font-mono text-sm text-slate-900 bg-transparent focus:outline-none cursor-pointer px-1 tabular-nums"
                        >
                          {HOURS_12.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono text-sm text-slate-400 select-none">:</span>
                        <select
                          aria-label={`Dose ${index + 1} minute`}
                          value={minute}
                          onChange={(e) =>
                            updateSlotTime(
                              row.uid,
                              to24HourString(hour12, e.target.value, meridiem)
                            )
                          }
                          className="font-mono text-sm text-slate-900 bg-transparent focus:outline-none cursor-pointer px-1 tabular-nums"
                        >
                          {MINUTES_60.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div
                        className="inline-flex p-0.5 bg-slate-200/80 rounded-lg"
                        role="group"
                        aria-label={`Dose ${index + 1} AM or PM`}
                      >
                        {(['AM', 'PM'] as const).map((periodChoice) => (
                          <button
                            key={periodChoice}
                            type="button"
                            onClick={() =>
                              updateSlotTime(
                                row.uid,
                                to24HourString(hour12, minute, periodChoice)
                              )
                            }
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                              meridiem === periodChoice
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {periodChoice}
                          </button>
                        ))}
                      </div>

                      {slotRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeScheduleSlot(row.uid)}
                          aria-label={`Remove dose ${index + 1}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {slotRows.length < SCHEMA_LIMITS.MAX_SCHEDULE_TIMES && (
              <button
                type="button"
                onClick={addScheduleSlot}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-teal-800 bg-teal-50/70 hover:bg-teal-100/80 border border-dashed border-teal-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Dose Time
              </button>
            )}
          </div>

          <div className="border-t border-slate-200 pt-5">
            <span className="block text-xs font-medium text-slate-700 mb-2">Frequency</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-lg mb-3">
              <button
                type="button"
                onClick={() => setFrequencyType('daily')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  frequencyType === 'daily'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Every Day
              </button>
              <button
                type="button"
                onClick={() => setFrequencyType('specific_days')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  frequencyType === 'specific_days'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Specific Days
              </button>
            </div>

            {frequencyType === 'specific_days' && (
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LABELS_SHORT.map((label, idx) => {
                  const selected = daysOfWeek.includes(idx);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-3">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-900">Track Supply & Refills</span>
                <span className="block text-xs text-slate-500">
                  Automatically count down remaining units each time a dose is marked taken
                </span>
              </div>
              <input
                type="checkbox"
                checked={trackSupply}
                onChange={(e) => setTrackSupply(e.target.checked)}
                className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
              />
            </label>

            {trackSupply && (
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label htmlFor="med-qty" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Current Supply
                  </label>
                  <input
                    id="med-qty"
                    type="number"
                    min={0}
                    max={SCHEMA_LIMITS.MAX_QUANTITY}
                    value={remainingQuantity}
                    onChange={(e) => setRemainingQuantity(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label htmlFor="med-threshold" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Low-Supply Alert At
                  </label>
                  <input
                    id="med-threshold"
                    type="number"
                    min={0}
                    max={SCHEMA_LIMITS.MAX_REFILL_THRESHOLD}
                    value={refillThreshold}
                    onChange={(e) => setRefillThreshold(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>
            )}

            {editingMedication && (
              <label className="flex items-center justify-between gap-4 pt-2 cursor-pointer">
                <div>
                  <span className="block text-sm font-medium text-slate-900">Schedule Active</span>
                  <span className="block text-xs text-slate-500">
                    Pause if temporarily stopped without deleting history
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
                />
              </label>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting ? 'Saving...' : editingMedication ? 'Save Changes' : 'Add Medication'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
