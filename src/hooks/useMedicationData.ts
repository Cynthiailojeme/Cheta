import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { buildDoseLogId } from '../lib/schedule';
import {
  DoseActionStatus,
  DoseLog,
  Medication,
  MedicationInput,
  SCHEMA_LIMITS,
} from '../types/medication';

function sanitizeMedicationPayload(input: MedicationInput) {
  const name = input.name.trim().slice(0, SCHEMA_LIMITS.NAME_MAX);
  const dosage = input.dosage.trim().slice(0, SCHEMA_LIMITS.DOSAGE_MAX);
  const instructions = input.instructions.trim().slice(0, SCHEMA_LIMITS.INSTRUCTIONS_MAX);
  const uniqueTimes = Array.from(
    new Set(
      input.scheduleTimes
        .map((t) => t.trim())
        .filter((t) => /^\d{2}:\d{2}$/.test(t))
    )
  )
    .sort()
    .slice(0, SCHEMA_LIMITS.MAX_SCHEDULE_TIMES);

  const scheduleTimes = uniqueTimes.length > 0 ? uniqueTimes : ['08:00'];
  const daysOfWeek =
    input.frequencyType === 'specific_days'
      ? Array.from(new Set(input.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort()
      : [];

  const remainingQuantity = Math.min(
    SCHEMA_LIMITS.MAX_QUANTITY,
    Math.max(SCHEMA_LIMITS.MIN_QUANTITY, Math.round(Number(input.remainingQuantity) || 0))
  );
  const refillThreshold = Math.min(
    SCHEMA_LIMITS.MAX_REFILL_THRESHOLD,
    Math.max(SCHEMA_LIMITS.MIN_QUANTITY, Math.round(Number(input.refillThreshold) || 0))
  );

  return {
    name,
    dosage,
    form: input.form,
    instructions,
    scheduleTimes,
    frequencyType: input.frequencyType,
    daysOfWeek,
    active: Boolean(input.active),
    trackSupply: Boolean(input.trackSupply),
    remainingQuantity,
    refillThreshold,
  };
}

export function useMedicationData(uid: string | undefined, authReady: boolean) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!authReady || !uid) {
      setMedications([]);
      setDoseLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let medsLoaded = false;
    let logsLoaded = false;

    const medsPath = `users/${uid}/medications`;
    const logsPath = `users/${uid}/doseLogs`;

    const medsQuery = query(collection(db, 'users', uid, 'medications'), where('userId', '==', uid));
    const logsQuery = query(collection(db, 'users', uid, 'doseLogs'), where('userId', '==', uid));

    const unsubMeds = onSnapshot(
      medsQuery,
      (snap) => {
        const items = snap.docs.map((d) => d.data() as Medication);
        items.sort((a, b) => a.name.localeCompare(b.name));
        setMedications(items);
        medsLoaded = true;
        if (medsLoaded && logsLoaded) setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, medsPath);
      }
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        const items = snap.docs.map((d) => d.data() as DoseLog);
        setDoseLogs(items);
        logsLoaded = true;
        if (medsLoaded && logsLoaded) setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, logsPath);
      }
    );

    return () => {
      unsubMeds();
      unsubLogs();
    };
  }, [uid, authReady]);

  const saveMedication = useCallback(
    async (input: MedicationInput) => {
      if (!uid) return;
      const clean = sanitizeMedicationPayload(input);
      if (!clean.name || !clean.dosage) {
        throw new Error('Medication name and dosage are required.');
      }

      if (input.id) {
        const medPath = `users/${uid}/medications/${input.id}`;
        const medRef = doc(db, 'users', uid, 'medications', input.id);
        try {
          await updateDoc(medRef, {
            ...clean,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, medPath);
        }
      } else {
        const colRef = collection(db, 'users', uid, 'medications');
        const newDocRef = doc(colRef);
        const medPath = `users/${uid}/medications/${newDocRef.id}`;
        try {
          await setDoc(newDocRef, {
            id: newDocRef.id,
            userId: uid,
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, medPath);
        }
      }
    },
    [uid]
  );

  const toggleMedicationActive = useCallback(
    async (medication: Medication) => {
      if (!uid) return;
      const medPath = `users/${uid}/medications/${medication.id}`;
      const medRef = doc(db, 'users', uid, 'medications', medication.id);
      try {
        await updateDoc(medRef, {
          active: !medication.active,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, medPath);
      }
    },
    [uid]
  );

  const refillMedicationSupply = useCallback(
    async (medication: Medication, addAmount: number) => {
      if (!uid) return;
      const medPath = `users/${uid}/medications/${medication.id}`;
      const medRef = doc(db, 'users', uid, 'medications', medication.id);
      const nextQty = Math.min(
        SCHEMA_LIMITS.MAX_QUANTITY,
        Math.max(0, medication.remainingQuantity + Math.round(addAmount))
      );
      try {
        await updateDoc(medRef, {
          remainingQuantity: nextQty,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, medPath);
      }
    },
    [uid]
  );

  const deleteMedication = useCallback(
    async (medicationId: string) => {
      if (!uid) return;
      const medPath = `users/${uid}/medications/${medicationId}`;
      const medRef = doc(db, 'users', uid, 'medications', medicationId);

      try {
        const batch = writeBatch(db);
        const relatedLogs = doseLogs.filter((l) => l.medicationId === medicationId);
        for (const log of relatedLogs) {
          batch.delete(doc(db, 'users', uid, 'doseLogs', log.id));
        }
        batch.delete(medRef);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, medPath);
      }
    },
    [uid, doseLogs]
  );

  const logDoseAction = useCallback(
    async (params: {
      medication: Medication;
      dateKey: string;
      scheduledTime: string;
      status: DoseActionStatus;
      snoozeMinutes?: number;
      notes?: string;
    }) => {
      if (!uid) return;
      const { medication, dateKey, scheduledTime, status, snoozeMinutes = 15, notes = '' } = params;
      const doseLogId = buildDoseLogId(medication.id, dateKey, scheduledTime);
      const logPath = `users/${uid}/doseLogs/${doseLogId}`;
      const logRef = doc(db, 'users', uid, 'doseLogs', doseLogId);
      const medRef = doc(db, 'users', uid, 'medications', medication.id);

      const now = new Date();
      const takenAt = status === 'taken' ? now.toISOString() : '';
      const snoozedUntil =
        status === 'snoozed'
          ? new Date(now.getTime() + snoozeMinutes * 60000).toISOString()
          : '';
      const cleanNotes = notes.trim().slice(0, SCHEMA_LIMITS.NOTES_MAX);

      try {
        const existingSnap = await getDoc(logRef);
        const existingStatus = existingSnap.exists()
          ? (existingSnap.data() as DoseLog).status
          : null;

        const batch = writeBatch(db);

        if (existingSnap.exists()) {
          batch.update(logRef, {
            status,
            takenAt,
            snoozedUntil,
            notes: cleanNotes,
            medicationName: medication.name.slice(0, SCHEMA_LIMITS.NAME_MAX),
            dosage: medication.dosage.slice(0, SCHEMA_LIMITS.DOSAGE_MAX),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(logRef, {
            id: doseLogId,
            userId: uid,
            medicationId: medication.id,
            medicationName: medication.name.slice(0, SCHEMA_LIMITS.NAME_MAX),
            dosage: medication.dosage.slice(0, SCHEMA_LIMITS.DOSAGE_MAX),
            dateKey,
            scheduledTime,
            status,
            takenAt,
            snoozedUntil,
            notes: cleanNotes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // Sync medication supply count when transitioning to/from 'taken'
        if (medication.trackSupply) {
          if (status === 'taken' && existingStatus !== 'taken') {
            batch.update(medRef, {
              remainingQuantity: Math.max(0, medication.remainingQuantity - 1),
              updatedAt: serverTimestamp(),
            });
          } else if (status !== 'taken' && existingStatus === 'taken') {
            batch.update(medRef, {
              remainingQuantity: Math.min(
                SCHEMA_LIMITS.MAX_QUANTITY,
                medication.remainingQuantity + 1
              ),
              updatedAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, logPath);
      }
    },
    [uid]
  );

  const resetDoseAction = useCallback(
    async (medication: Medication, dateKey: string, scheduledTime: string) => {
      if (!uid) return;
      const doseLogId = buildDoseLogId(medication.id, dateKey, scheduledTime);
      const logPath = `users/${uid}/doseLogs/${doseLogId}`;
      const logRef = doc(db, 'users', uid, 'doseLogs', doseLogId);
      const medRef = doc(db, 'users', uid, 'medications', medication.id);

      try {
        const existingSnap = await getDoc(logRef);
        if (!existingSnap.exists()) return;
        const existingStatus = (existingSnap.data() as DoseLog).status;

        if (medication.trackSupply && existingStatus === 'taken') {
          const batch = writeBatch(db);
          batch.delete(logRef);
          batch.update(medRef, {
            remainingQuantity: Math.min(
              SCHEMA_LIMITS.MAX_QUANTITY,
              medication.remainingQuantity + 1
            ),
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } else {
          await deleteDoc(logRef);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, logPath);
      }
    },
    [uid]
  );

  return {
    medications,
    doseLogs,
    loading,
    saveMedication,
    toggleMedicationActive,
    refillMedicationSupply,
    deleteMedication,
    logDoseAction,
    resetDoseAction,
  };
}
