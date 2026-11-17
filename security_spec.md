# Security Specification — Cadence Medication Tracker

## 1. Data Invariants
1. **Strict User Isolation**: Every `UserProfile`, `Medication`, and `DoseLog` belongs exclusively to an authenticated, email-verified user (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **Referential Integrity**: A `DoseLog` cannot be created unless its referenced `medicationId` exists under `/users/{userId}/medications/{medicationId}`.
3. **Immutable Ownership & Identity**: `uid`, `userId`, `id`, and `createdAt` cannot be modified after creation. On `DoseLog`, `medicationId`, `dateKey`, and `scheduledTime` are immutable.
4. **Temporal Integrity**: `createdAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on creation and every update.
5. **Bounded Payload & Schema Strictness**: Every string has a bounded `.size()`, arrays are capped (`scheduleTimes.size() <= 8`, `daysOfWeek.size() <= 7`), enums are strictly allowlisted, and unknown/shadow fields are rejected via `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read/Write**: User A attempts to read or write `/users/userB/medications/med1`. Expected: `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: Authenticated user with `email_verified: false` attempts to create a medication. Expected: `PERMISSION_DENIED`.
3. **Shadow Field Injection (Medication Create)**: Payload includes extra `isAdmin: true` or `verifiedByDoctor: true`. Expected: `PERMISSION_DENIED`.
4. **Shadow Field Injection (DoseLog Update)**: Update payload changes `status` plus an unexpected `ghostField: "x"`. Expected: `PERMISSION_DENIED`.
5. **Orphaned DoseLog Create**: `DoseLog` created referencing a non-existent `medicationId: "missing_med"`. Expected: `PERMISSION_DENIED`.
6. **ID Poisoning**: Document ID contains spaces or 500-char junk string (`"med id !@#"`). Expected: `PERMISSION_DENIED`.
7. **Ownership Hijack on Update**: Update payload changes `userId` from `userA` to `userB`. Expected: `PERMISSION_DENIED`.
8. **Immutable CreatedAt Tampering**: Update payload modifies `createdAt` or create payload sends a backdated timestamp instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
9. **Unbounded Array / Denial-of-Wallet**: `scheduleTimes` contains 15 entries (`> 8`) or `name` is a 10KB string. Expected: `PERMISSION_DENIED`.
10. **Invalid Enum Value**: `DoseLog.status` set to `"deleted"` or `Medication.form` set to `"SyringeWeapon"`. Expected: `PERMISSION_DENIED`.
11. **User Collection Scraping (`list` on `/users`)**: Authenticated user runs a `list` query on `/users` to enumerate emails. Expected: `PERMISSION_DENIED`.
12. **Type Poisoning**: `remainingQuantity` sent as `"fifty"` (string) or `active` sent as `1` (number). Expected: `PERMISSION_DENIED`.
