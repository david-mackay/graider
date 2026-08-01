# Permission & behavior test catalog

Living checklist for Graider API/lib gating. Each case has an ID so agents can implement modules independently.

**How to use this workflow**

1. Pick a module section below (e.g. `M5` submissions).
2. Implement only that module’s cases in `lib/__tests__/` or `app/api/__tests__/`.
3. Mark the case `[x]` when green under `npm test`.
4. Do not expand scope into another module in the same pass unless a shared fixture is required.

**Layers**

| Layer | Location | Speed | Needs DB |
|-------|----------|-------|----------|
| L1 pure unit | `lib/__tests__/*.test.ts` | fast | no |
| L2 route contract (mocked auth/db) | `app/api/__tests__/*.test.ts` | fast | no |
| L3 integration (real DB) | future `test/integration/` | slow | yes |

Current baseline targets **L1 + L2**. L3 is deferred until a test database is wired.

**Actors (fixtures)**

| ID | Meaning |
|----|---------|
| `anon` | no Clerk session |
| `studentA` | app role student, member of classA |
| `studentB` | app role student, member of classB only |
| `teacherA` | app role teacher, teacher of classA |
| `teacherB` | app role teacher, teacher of classB only |
| `outsider` | signed-in, no memberships |

---

## M0 — Pure libs (L1)

### M0.1 `lib/test-availability.ts`

- [x] `TA-01` draft → `isTestAvailableNow` false
- [x] `TA-02` open, no close → available
- [x] `TA-03` open, past closesAt, late false → unavailable
- [x] `TA-04` open, past closesAt, late true → available
- [x] `TA-05` scheduled before opensAt → unavailable
- [x] `TA-06` scheduled inside window → available
- [x] `TA-07` closed + late false → unavailable to start
- [x] `TA-08` closed + late true → available to start
- [x] `TA-09` `getAttemptDeadline` prefers duration over closesAt once started
- [x] `TA-10` `canSubmitAttempt` blocks before opensAt (scheduled)
- [x] `TA-11` `canSubmitAttempt` allows within duration after close (late false)
- [x] `TA-12` `canSubmitAttempt` blocks past deadline + skew (late false)
- [x] `TA-13` `canSubmitAttempt` allows past deadline when late true
- [x] `TA-14` draft status always blocks submit

### M0.2 `lib/mcq.ts`

- [x] `MCQ-01` normalize letters: `B`, `(B)`, `B.`, `option B`, case-insensitive
- [x] `MCQ-02` normalize rejects empty / long noise without letter
- [x] `MCQ-03` exact match awards full marks, feedback `"Correct"` (no key leak)
- [x] `MCQ-04` wrong letter → 0, feedback `"Incorrect"` (no key leak)
- [x] `MCQ-05` missing key letter → 0 with key-missing feedback
- [x] `MCQ-06` empty student answer → incorrect, no key leak
- [x] `MCQ-07` `coerceQuestionType` / `coerceChoices` / `deriveTestQuestionMix`

### M0.3 `lib/roster-students.ts` (validators only)

- [x] `RS-01` `isRosterManagedUserId` true only for `roster_` prefix
- [x] `RS-02` `normalizeStudentName` trim / reject empty / reject too long
- [x] `RS-03` `normalizeStudentEmail` null/empty/valid/invalid

---

## M1 — Auth / me (L2)

### `GET|POST /api/me/role`

- [x] `ME-ROLE-01` anon → 401
- [x] `ME-ROLE-02` student with no memberships may become teacher
- [x] `ME-ROLE-03` student with active student membership cannot become teacher → 403
- [x] `ME-ROLE-04` teacher may become student
- [x] `ME-ROLE-05` GET returns current user

### `PATCH /api/me/profile`

- [x] `ME-PROF-01` anon → 401
- [x] `ME-PROF-02` signed-in can update own name

### `GET /api/me/subscription` (+ sync)

- [x] `ME-SUB-01` student → 403
- [x] `ME-SUB-02` teacher → 200

### `DELETE /api/me`

- [x] `ME-DEL-01` anon → 401
- [x] `ME-DEL-02` signed-in only deletes self (no impersonation)

---

## M2 — Classes / invites / roster (L2)

### `GET|POST /api/classes`

- [x] `CL-01` anon GET → 401
- [x] `CL-02` member sees only own classes
- [x] `CL-03` student POST create → 403
- [x] `CL-04` teacher POST create → 201

### `PATCH /api/classes/[classId]`

- [x] `CL-05` teacherB cannot rename classA → 403
- [x] `CL-06` teacherA can rename classA

### `POST /api/classes/join`

- [x] `JOIN-01` anon → 401
- [x] `JOIN-02` pending named student invite → join ok
- [x] `JOIN-03` already-used invite → 410
- [x] `JOIN-04` already active member does **not** burn pending invite
- [x] `JOIN-05` email-bound invite requires matching Clerk email → 403 otherwise
- [x] `JOIN-06` lowercase code still works (normalized)
- [ ] `JOIN-07` concurrent single-use: only one succeeds (L3 preferred)

### Invites `.../invite`

- [x] `INV-01` student cannot create invite → 403
- [x] `INV-02` teacherB cannot invite into classA → 403
- [x] `INV-03` student invites require name; always single-use
- [x] `INV-04` teacher can list/revoke own class invites

### Roster / members / students

- [x] `ROST-01` student cannot read roster → 403
- [x] `ROST-02` teacherB cannot read classA roster → 403
- [x] `ROST-03` teacherA can create roster student
- [x] `ROST-04` cannot PATCH Clerk-backed student profile via roster update
- [x] `ROST-05` teacherA can delete roster student

---

## M3 — Questions (L2)

- [x] `Q-01` student GET/POST questions → 403
- [x] `Q-02` teacherB cannot mutate classA questions → 403
- [x] `Q-03` MCQ create rejects non A–E answer key → 400
- [x] `Q-04` MCQ create rejects key not in choices → 400
- [x] `Q-05` teacherA can create open + mcq questions
- [x] `Q-06` answer keys never returned on student-facing test detail (covered in M4)

---

## M4 — Tests / admin (L2)

- [x] `T-01` student cannot create test → 403
- [x] `T-02` teacherB cannot PATCH classA test → 403
- [x] `T-03` student GET test before open → 403 / unavailable (match product)
- [x] `T-04` student GET test never includes `correct_answer`
- [x] `T-05` teacher GET includes `correct_answer`
- [x] `T-06` schedule / open_now / close_now only by class teacher

---

## M5 — Submissions / drafts (L2) — **priority**

- [x] `SUB-01` anon start/submit/draft → 401
- [x] `SUB-02` teacher cannot start student attempt → 403
- [x] `SUB-03` studentB cannot start classA test → 403
- [x] `SUB-04` start blocked when not available
- [x] `SUB-05` submit without prior start → 400
- [x] `SUB-06` submit after deadline (late false) → 403 even with `timed_out: true`
- [x] `SUB-07` submit before opensAt → 403
- [x] `SUB-08` double submit → 409
- [x] `SUB-09` draft PATCH by owner while in window → 200
- [x] `SUB-10` draft PATCH by other student → 403
- [x] `SUB-11` draft PATCH after submitted → 409
- [x] `SUB-12` start resume returns saved draft answers
- [x] `SUB-13` student cannot GET other student’s attempt detail → 403
- [x] `SUB-14` student cannot GET own graded attempt before release → 403
- [x] `SUB-15` teacher cannot manually grade unsubmitted attempt → 409
- [x] `SUB-16` teacherB cannot grade classA attempt → 403

---

## M6 — Grade / OCR / stack (L2)

- [x] `GR-01` student cannot POST /api/grade → 403
- [x] `GR-02` teacherB cannot grade classA → 403
- [x] `GR-03` grade unsubmitted → 409 (`AttemptNotSubmittedError`)
- [x] `GR-04` OCR refuses in-progress digital student attempt → 409
- [x] `GR-05` OCR refuses submitted digital student attempt → 409
- [x] `GR-06` stack commit refuses to clobber digital student attempts
- [x] `GR-07` grade-stack job GET must not leak other teachers’ jobs (**IDOR — fixed**)
- [x] `GR-08` MCQ path sets `gradedBy: "exact"` (unit/integration)

---

## M7 — Uploads (L2)

- [x] `UP-01` student cannot sign upload → 403
- [x] `UP-02` teacherB cannot sign for classA test → 403
- [x] `UP-03` signed URL purpose limited to allowed kinds
- [x] `UP-04` GET upload path traversal rejected
- [x] `UP-05` GET upload requires class/job access

---

## M8 — Onboarding / public / webhooks (L2)

- [x] `ON-01` public parse/sample-grade remain unauthenticated but rate-limited
- [x] `ON-02` sync requires auth; may set teacher only via onboarding path
- [x] `WH-01` revenuecat webhook rejects missing/invalid bearer
- [x] `WH-02` valid bearer accepted
- [x] `PUB-01` health + app-version public

---

## Pure coverage complete (no mocks)

All cases that can be asserted without Clerk/DB/HTTP mocks are checked above and live under `lib/__tests__/`.

## L2 harness

- `app/api/__tests__/helpers/l2-mocks.ts` — `mock.module` for `@/lib/auth`, `@/lib/db`, `@/lib/grading`
- `app/api/__tests__/helpers/scripted-db.ts` — queued select replies
- Run via `npm run test:api` (needs `--experimental-test-module-mocks`)
- `npm test` = `test:l1` then `test:api` (separate processes so mocks don’t leak)

### M5 L2 — done
### M1 L2 — done
### M2 L2 — done (JOIN-07 deferred to L3)
### M3 + M4 L2 — done
### M6 + M7 L2 — done (GR-07 IDOR fixed)
### M8 L2 — done

**L1 + L2 catalog complete** except `JOIN-07` (L3 concurrent invite race).

| Pass | Module | Goal |
|------|--------|------|
| 1 | M0 | Pure libs green (baseline CI) |
| 2 | M5 + M1 role/join subset | Lock recent hardening |
| 3 | M2 invites/roster | Onboarding safety |
| 4 | M3 + M4 | Answer-key leakage |
| 5 | M6 + M7 | Grading/upload IDOR |
| 6 | M8 | Public/webhook edges |
| 7 | L3 | Optional real-DB matrix |

**Commands**

```bash
cd graider
npm test                 # all
npm test -- M0           # by file pattern once named
npm test -- test-availability
```

**Definition of done for a module pass**

- All cases in that section checked `[x]`
- `npm test` passes
- No production code changes unless a catalog case reveals a bug (then fix + keep the test)
