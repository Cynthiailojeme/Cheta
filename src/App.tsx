import { useEffect, useState } from 'react';
import {
  Bell,
  CalendarClock,
  Check,
  History,
  LogOut,
  Menu,
  Pill,
  Plus,
  Timer,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HistoryView } from './components/HistoryView';
import { MedicationModal } from './components/MedicationModal';
import { MedicationsView } from './components/MedicationsView';
import { RemindersView } from './components/RemindersView';
import { SignInScreen } from './components/SignInScreen';
import { TodayTimelineView } from './components/TodayTimelineView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useDoseReminders } from './hooks/useDoseReminders';
import { useMedicationData } from './hooks/useMedicationData';
import { Medication } from './types/medication';

type NavTab = 'today' | 'medications' | 'history' | 'reminders';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof CalendarClock }[] = [
  { id: 'today', label: "Today's Doses", icon: CalendarClock },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'history', label: 'History', icon: History },
  { id: 'reminders', label: 'Reminders', icon: Bell },
];

function ChetaWorkspace() {
  const { user, profile, authReady, logout, updateReminderPreferences } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Tick every 15 seconds to keep dose reminder windows and overdue checks live
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const {
    medications,
    doseLogs,
    loading,
    saveMedication,
    toggleMedicationActive,
    refillMedicationSupply,
    deleteMedication,
    logDoseAction,
    resetDoseAction,
  } = useMedicationData(user?.uid, authReady);

  const {
    activeAlerts,
    permissionState,
    dismissAlert,
    requestBrowserPermission,
    triggerTestReminder,
  } = useDoseReminders({
    medications,
    doseLogs,
    profile,
    now,
  });

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading your schedule...</div>
      </div>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  const snoozeDefault = profile?.snoozeDefaultMinutes ?? 15;
  const leadMinutes = profile?.reminderLeadMinutes ?? 10;

  const openAddModal = () => {
    setEditingMedication(null);
    setModalOpen(true);
  };

  const openEditModal = (med: Medication) => {
    setEditingMedication(med);
    setModalOpen(true);
  };

  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];
  const dueCount = activeAlerts.filter((a) => !a.isTest).length;
  const displayName = profile?.displayName || user.displayName || user.email || 'Account';
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-200 flex items-center justify-between">
        <span className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap">
          Cheta
        </span>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </span>
              {item.id === 'today' && dueCount > 0 && (
                <span className="font-mono text-xs text-amber-700 tabular-nums">
                  {dueCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-900 truncate">{displayName}</div>
            <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] bg-white border-r border-slate-200 h-full z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display text-lg font-semibold text-slate-900 truncate">
                  {currentNav.label}
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medication</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Active Daily Dose Reminder Bar */}
          {activeAlerts.length > 0 && (
            <section aria-label="Active dose reminders" className="space-y-2.5">
              {activeAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  role="status"
                  className="bg-white border border-amber-300 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Bell className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {alert.title}
                      </div>
                      <div className="text-xs text-slate-600">{alert.body}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                    {alert.slot && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void logDoseAction({
                              medication: alert.slot!.medication,
                              dateKey: alert.slot!.dateKey,
                              scheduledTime: alert.slot!.scheduledTime,
                              status: 'taken',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Taken
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void logDoseAction({
                              medication: alert.slot!.medication,
                              dateKey: alert.slot!.dateKey,
                              scheduledTime: alert.slot!.scheduledTime,
                              status: 'snoozed',
                              snoozeMinutes: snoozeDefault,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Timer className="w-3.5 h-3.5" />
                          Snooze {snoozeDefault}m
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      aria-label="Dismiss reminder"
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {activeTab === 'today' && (
            <TodayTimelineView
              medications={medications}
              doseLogs={doseLogs}
              loading={loading}
              now={now}
              reminderLeadMinutes={leadMinutes}
              snoozeDefaultMinutes={snoozeDefault}
              onLogDose={logDoseAction}
              onResetDose={resetDoseAction}
              onAddMedication={openAddModal}
            />
          )}

          {activeTab === 'medications' && (
            <MedicationsView
              medications={medications}
              loading={loading}
              onAddMedication={openAddModal}
              onEditMedication={openEditModal}
              onToggleActive={toggleMedicationActive}
              onRefillSupply={refillMedicationSupply}
              onDeleteMedication={deleteMedication}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              medications={medications}
              doseLogs={doseLogs}
              loading={loading}
              now={now}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersView
              profile={profile}
              permissionState={permissionState}
              onRequestBrowserPermission={requestBrowserPermission}
              onUpdatePreferences={updateReminderPreferences}
              onTriggerTestReminder={triggerTestReminder}
            />
          )}
        </main>
      </div>

      <MedicationModal
        open={modalOpen}
        editingMedication={editingMedication}
        onClose={() => setModalOpen(false)}
        onSave={saveMedication}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ChetaWorkspace />
      </AuthProvider>
    </ErrorBoundary>
  );
}
