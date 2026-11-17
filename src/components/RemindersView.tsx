import { useState } from 'react';
import { Bell, BellOff, CheckCircle2, Volume2 } from 'lucide-react';
import { BrowserNotificationSupport } from '../hooks/useDoseReminders';
import { UserProfile } from '../types/medication';

interface RemindersViewProps {
  profile: UserProfile | null;
  permissionState: BrowserNotificationSupport;
  onRequestBrowserPermission: () => Promise<BrowserNotificationSupport>;
  onUpdatePreferences: (
    patch: Partial<
      Pick<
        UserProfile,
        | 'browserNotificationsEnabled'
        | 'soundAlertsEnabled'
        | 'reminderLeadMinutes'
        | 'snoozeDefaultMinutes'
      >
    >
  ) => Promise<void>;
  onTriggerTestReminder: () => void;
}

const LEAD_TIME_OPTIONS = [
  { label: 'At scheduled time', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '10 minutes before', value: 10 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
];

const SNOOZE_OPTIONS = [
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
];

export function RemindersView({
  profile,
  permissionState,
  onRequestBrowserPermission,
  onUpdatePreferences,
  onTriggerTestReminder,
}: RemindersViewProps) {
  const [saving, setSaving] = useState(false);

  const browserEnabled = profile?.browserNotificationsEnabled ?? false;
  const soundEnabled = profile?.soundAlertsEnabled ?? true;
  const leadMinutes = profile?.reminderLeadMinutes ?? 10;
  const snoozeMinutes = profile?.snoozeDefaultMinutes ?? 15;

  const handleToggleBrowserAlerts = async () => {
    setSaving(true);
    try {
      if (!browserEnabled) {
        const perm =
          permissionState === 'granted'
            ? 'granted'
            : await onRequestBrowserPermission();
        if (perm === 'granted') {
          await onUpdatePreferences({ browserNotificationsEnabled: true });
        }
      } else {
        await onUpdatePreferences({ browserNotificationsEnabled: false });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Daily Reminder Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure when Cheta notifies you for upcoming doses and how alerts behave
            </p>
          </div>
          <button
            type="button"
            onClick={onTriggerTestReminder}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Bell className="w-3.5 h-3.5" />
            Send Test Reminder
          </button>
        </div>

        {/* Browser Notifications */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              {browserEnabled && permissionState === 'granted' ? (
                <Bell className="w-4 h-4 text-teal-700" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-400" />
              )}
              <span>Desktop & Browser Notifications</span>
            </div>
            <p className="text-xs text-slate-500 max-w-lg">
              Show system alerts when a medication dose enters your reminder window while this tab
              is open. In-app reminder banners always remain active regardless of browser permission.
            </p>
            {permissionState === 'denied' && (
              <p className="text-xs text-amber-700 pt-1">
                Browser notifications are currently blocked in your browser site settings.
              </p>
            )}
            {permissionState === 'unsupported' && (
              <p className="text-xs text-slate-500 pt-1">
                System notifications are unavailable in this browser environment; in-app alerts are
                active.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={saving || permissionState === 'unsupported' || permissionState === 'denied'}
            onClick={handleToggleBrowserAlerts}
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              browserEnabled && permissionState === 'granted'
                ? 'bg-teal-700 border-teal-700 text-white hover:bg-teal-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50'
            }`}
          >
            {browserEnabled && permissionState === 'granted' ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Enabled
              </span>
            ) : (
              'Enable Notifications'
            )}
          </button>
        </div>

        {/* Gentle Sound Chime */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Volume2 className="w-4 h-4 text-teal-700" />
              <span>Gentle Sound Chime</span>
            </div>
            <p className="text-xs text-slate-500">
              Play a soft two-note chime when a dose becomes due or a snooze timer expires
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Toggle gentle sound chime"
            checked={soundEnabled}
            onChange={(e) => void onUpdatePreferences({ soundAlertsEnabled: e.target.checked })}
            className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
          />
        </div>

        {/* Lead Time */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label htmlFor="lead-time-select" className="block text-sm font-medium text-slate-900">
              Reminder Lead Time
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              How early before each scheduled time to surface your dose reminder
            </p>
          </div>
          <select
            id="lead-time-select"
            value={leadMinutes}
            onChange={(e) =>
              void onUpdatePreferences({ reminderLeadMinutes: Number(e.target.value) })
            }
            className="px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
          >
            {LEAD_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Default Snooze */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label htmlFor="snooze-select" className="block text-sm font-medium text-slate-900">
              Default Snooze Duration
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Delay duration when you tap Snooze on a dose reminder
            </p>
          </div>
          <select
            id="snooze-select"
            value={snoozeMinutes}
            onChange={(e) =>
              void onUpdatePreferences({ snoozeDefaultMinutes: Number(e.target.value) })
            }
            className="px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
          >
            {SNOOZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}
