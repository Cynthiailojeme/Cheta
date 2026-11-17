import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildDailySchedule,
  formatTime12h,
  getDateKey,
  playGentleChime,
} from '../lib/schedule';
import { DoseLog, Medication, ScheduledDose, UserProfile } from '../types/medication';

export type BrowserNotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied';

export interface ActiveReminderAlert {
  id: string;
  title: string;
  body: string;
  slot?: ScheduledDose;
  isTest?: boolean;
}

export function getNotificationPermissionState(): BrowserNotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as BrowserNotificationSupport;
}

export function useDoseReminders(params: {
  medications: Medication[];
  doseLogs: DoseLog[];
  profile: UserProfile | null;
  now: Date;
}) {
  const { medications, doseLogs, profile, now } = params;
  const [permissionState, setPermissionState] = useState<BrowserNotificationSupport>(() =>
    getNotificationPermissionState()
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [testAlert, setTestAlert] = useState<ActiveReminderAlert | null>(null);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  const leadMinutes = profile?.reminderLeadMinutes ?? 10;
  const soundEnabled = profile?.soundAlertsEnabled ?? true;
  const browserEnabled = profile?.browserNotificationsEnabled ?? false;

  const todayKey = getDateKey(now);

  const dueTodaySlots = useMemo(() => {
    const todaySlots = buildDailySchedule(medications, doseLogs, todayKey, now, leadMinutes);
    return todaySlots.filter((s) => s.status === 'due' || s.status === 'overdue');
  }, [medications, doseLogs, todayKey, now, leadMinutes]);

  const activeAlerts: ActiveReminderAlert[] = useMemo(() => {
    const list: ActiveReminderAlert[] = [];
    if (testAlert) list.push(testAlert);

    for (const slot of dueTodaySlots) {
      const snoozeStamp = slot.log?.snoozedUntil || '';
      const alertKey = `${slot.slotId}_${snoozeStamp}`;
      if (dismissedIds.has(alertKey)) continue;

      const timeLabel = formatTime12h(slot.scheduledTime);
      const isOverdue = slot.status === 'overdue';
      list.push({
        id: alertKey,
        title: `${slot.medication.name} (${slot.medication.dosage})`,
        body: isOverdue
          ? `Scheduled for ${timeLabel} · Overdue`
          : `Scheduled for ${timeLabel} · Due now`,
        slot,
      });
    }
    return list;
  }, [dueTodaySlots, dismissedIds, testAlert]);

  useEffect(() => {
    let triggeredNew = false;

    for (const alert of activeAlerts) {
      if (alert.isTest) continue;
      if (notifiedKeysRef.current.has(alert.id)) continue;

      notifiedKeysRef.current.add(alert.id);
      triggeredNew = true;

      if (
        browserEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(`Dose Reminder: ${alert.title}`, {
            body: alert.body,
            tag: alert.id,
          });
        } catch {
          // Ignore browser notification restrictions inside nested contexts
        }
      }
    }

    if (triggeredNew && soundEnabled) {
      playGentleChime();
    }
  }, [activeAlerts, browserEnabled, soundEnabled]);

  const dismissAlert = useCallback((alertId: string) => {
    if (alertId === 'test_reminder') {
      setTestAlert(null);
      return;
    }
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  }, []);

  const requestBrowserPermission = useCallback(async (): Promise<BrowserNotificationSupport> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionState('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      const state = result as BrowserNotificationSupport;
      setPermissionState(state);
      return state;
    } catch {
      const fallback = getNotificationPermissionState();
      setPermissionState(fallback);
      return fallback;
    }
  }, []);

  const triggerTestReminder = useCallback(() => {
    if (soundEnabled) {
      playGentleChime();
    }

    if (
      browserEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('Cheta Dose Reminder (Test)', {
          body: 'Morning Lisinopril 10 mg is scheduled now.',
          tag: 'cheta-test-reminder',
        });
      } catch {
        // Ignore iframe Notification restrictions
      }
    }

    setTestAlert({
      id: 'test_reminder',
      title: 'Test Reminder · Lisinopril (10 mg)',
      body: 'This is how your daily dose alert appears when a scheduled dose is due.',
      isTest: true,
    });
  }, [browserEnabled, soundEnabled]);

  return {
    activeAlerts,
    permissionState,
    dismissAlert,
    requestBrowserPermission,
    triggerTestReminder,
  };
}
