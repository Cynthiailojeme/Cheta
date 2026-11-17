import { useState } from 'react';
import { Bell, CalendarCheck, Pill, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const STILL_LIFE_SRC = '/src/assets/images/cadence_apothecary_still_life_1794928608266.jpg';

export function SignInScreen() {
  const { signInWithGoogle, signingIn, authError } = useAuth();
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Cheta
          </span>
          <div className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
            <span className="whitespace-nowrap shrink-0">Daily Dose Timeline</span>
            <span className="whitespace-nowrap shrink-0">Timely Reminders</span>
            <span className="whitespace-nowrap shrink-0">Supply Tracking</span>
          </div>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={signingIn}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {signingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto w-full px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium text-teal-700 mb-3">
                Personal Medication Tracker
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-slate-900 leading-[1.15] mb-5 [text-wrap:balance]">
                Clear daily schedules and dependable reminders for every dose.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed mb-8 max-w-xl">
                Organize prescriptions and supplements by morning, afternoon, evening, and bedtime.
                Log doses in one tap, snooze when plans shift, and monitor refill counts without clutter.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={signingIn}
                  className="inline-flex items-center justify-center gap-3 px-6 py-3 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                    />
                  </svg>
                  {signingIn ? 'Connecting with Google...' : 'Continue with Google'}
                </button>
                <span className="text-xs text-slate-500">
                  Private account sync across sessions and devices
                </span>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="mb-6 p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
                >
                  {authError}
                </div>
              )}

              <div className="border-t border-slate-200 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900 mb-1">
                    <Bell className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Dose Alerts</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Lead-time alerts, gentle audio chimes, and flexible snooze intervals.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900 mb-1">
                    <CalendarCheck className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Adherence Log</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Track taken and skipped doses across 7-day and 30-day timelines.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900 mb-1">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Private Records</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Your regimen and dose logs are isolated strictly to your signed-in account.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 flex">
              <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-white flex flex-col">
                {!imgFailed ? (
                  <img
                    src={STILL_LIFE_SRC}
                    alt="Minimalist amber apothecary medication bottle beside a ceramic pill tray and pocket timer"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-72 sm:h-80 lg:h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-72 sm:h-80 lg:h-full bg-slate-100 flex flex-col items-center justify-center p-8 text-center">
                    <Pill className="w-10 h-10 text-teal-700 mb-3" />
                    <p className="font-display text-base font-medium text-slate-800">
                      Cheta Daily Regimen
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Structured daily schedules and refill reminders
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
