import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types/medication';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateReminderPreferences: (
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      const userPath = `users/${fbUser.uid}`;
      const userRef = doc(db, 'users', fbUser.uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const displayName = (fbUser.displayName || fbUser.email || 'Member').trim().slice(0, 120);
          const email = (fbUser.email || 'user@example.com').trim().slice(0, 254);
          const photoURL = (fbUser.photoURL || '').slice(0, 500);

          await setDoc(userRef, {
            uid: fbUser.uid,
            displayName,
            email,
            photoURL,
            browserNotificationsEnabled: false,
            soundAlertsEnabled: true,
            reminderLeadMinutes: 10,
            snoozeDefaultMinutes: 15,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to sign in with Google. Please try again.';
      setAuthError(message);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const updateReminderPreferences = useCallback(
    async (
      patch: Partial<
        Pick<
          UserProfile,
          | 'browserNotificationsEnabled'
          | 'soundAlertsEnabled'
          | 'reminderLeadMinutes'
          | 'snoozeDefaultMinutes'
        >
      >
    ) => {
      if (!user) return;
      const userPath = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);

      const sanitized: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (typeof patch.browserNotificationsEnabled === 'boolean') {
        sanitized.browserNotificationsEnabled = patch.browserNotificationsEnabled;
      }
      if (typeof patch.soundAlertsEnabled === 'boolean') {
        sanitized.soundAlertsEnabled = patch.soundAlertsEnabled;
      }
      if (typeof patch.reminderLeadMinutes === 'number') {
        sanitized.reminderLeadMinutes = Math.min(120, Math.max(0, Math.round(patch.reminderLeadMinutes)));
      }
      if (typeof patch.snoozeDefaultMinutes === 'number') {
        sanitized.snoozeDefaultMinutes = Math.min(60, Math.max(5, Math.round(patch.snoozeDefaultMinutes)));
      }

      try {
        await updateDoc(userRef, sanitized);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        signingIn,
        authError,
        signInWithGoogle,
        logout,
        updateReminderPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
