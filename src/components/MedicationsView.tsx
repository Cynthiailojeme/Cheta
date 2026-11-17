import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  PackagePlus,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { DAY_LABELS_SHORT, formatTime12h } from '../lib/schedule';
import { Medication } from '../types/medication';

interface MedicationsViewProps {
  medications: Medication[];
  loading: boolean;
  onAddMedication: () => void;
  onEditMedication: (medication: Medication) => void;
  onToggleActive: (medication: Medication) => Promise<void>;
  onRefillSupply: (medication: Medication, amount: number) => Promise<void>;
  onDeleteMedication: (medicationId: string) => Promise<void>;
}

export function MedicationsView({
  medications,
  loading,
  onAddMedication,
  onEditMedication,
  onToggleActive,
  onRefillSupply,
  onDeleteMedication,
}: MedicationsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredMedications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return medications.filter((med) => {
      if (statusFilter === 'active' && !med.active) return false;
      if (statusFilter === 'paused' && med.active) return false;
      if (!q) return true;
      return (
        med.name.toLowerCase().includes(q) ||
        med.dosage.toLowerCase().includes(q) ||
        med.instructions.toLowerCase().includes(q)
      );
    });
  }, [medications, searchQuery, statusFilter]);

  const handleToggle = async (med: Medication) => {
    setBusyId(med.id);
    try {
      await onToggleActive(med);
    } finally {
      setBusyId(null);
    }
  };

  const handleRefill = async (med: Medication) => {
    setBusyId(med.id);
    try {
      await onRefillSupply(med, 30);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await onDeleteMedication(id);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 p-5 animate-pulse bg-slate-50/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medications or instructions..."
            aria-label="Search medications"
            className="w-full pl-9 pr-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'paused', label: 'Paused' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAddMedication}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Medication
          </button>
        </div>
      </div>

      {medications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">
            Your medication cabinet is empty
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Store your medication dosages, instructions, daily reminder times, and refill counts in
            one organized place.
          </p>
          <button
            type="button"
            onClick={onAddMedication}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Medication
          </button>
        </div>
      ) : filteredMedications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-slate-900 mb-1">No matching medications</p>
          <p className="text-xs text-slate-500">
            Adjust your search query or status filter to view other medications.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Medication</th>
                  <th className="py-3 px-4">Daily Schedule</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Supply</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredMedications.map((med) => {
                  const isBusy = busyId === med.id;
                  const isLowSupply =
                    med.trackSupply && med.remainingQuantity <= med.refillThreshold;
                  const freqText =
                    med.frequencyType === 'daily'
                      ? 'Every day'
                      : med.daysOfWeek.map((d) => DAY_LABELS_SHORT[d]).join(', ');

                  return (
                    <tr key={med.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-5 align-top">
                        <div className="font-semibold text-slate-900">{med.name}</div>
                        <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                          {med.dosage} · {med.form}
                        </div>
                        {med.instructions && (
                          <div className="text-xs text-slate-500 mt-1 max-w-xs">
                            {med.instructions}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 align-top">
                        <div className="font-mono text-xs text-slate-900 tabular-nums space-y-1">
                          {med.scheduleTimes.map((t) => (
                            <div key={t}>{formatTime12h(t)}</div>
                          ))}
                        </div>
                      </td>

                      <td className="py-4 px-4 align-top text-xs text-slate-600">
                        {freqText || 'Every day'}
                      </td>

                      <td className="py-4 px-4 align-top">
                        {med.trackSupply ? (
                          <div className="space-y-1.5">
                            <div
                              className={`inline-flex items-center gap-1.5 text-xs font-medium tabular-nums ${
                                isLowSupply ? 'text-amber-700' : 'text-slate-700'
                              }`}
                            >
                              {isLowSupply && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                              <span>{med.remainingQuantity} remaining</span>
                            </div>
                            <div>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleRefill(med)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer whitespace-nowrap"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                +30 Refill
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not tracked</span>
                        )}
                      </td>

                      <td className="py-4 px-4 align-top">
                        {med.active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 whitespace-nowrap">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                            <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                            Paused
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 align-top text-right">
                        {confirmDeleteId === med.id ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-red-700 font-medium">Delete?</span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(med.id)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onEditMedication(med)}
                              aria-label={`Edit ${med.name}`}
                              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggle(med)}
                              aria-label={med.active ? `Pause ${med.name}` : `Resume ${med.name}`}
                              title={med.active ? 'Pause schedule' : 'Resume schedule'}
                              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              {med.active ? (
                                <PauseCircle className="w-4 h-4" />
                              ) : (
                                <PlayCircle className="w-4 h-4 text-teal-700" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(med.id)}
                              aria-label={`Delete ${med.name}`}
                              className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
