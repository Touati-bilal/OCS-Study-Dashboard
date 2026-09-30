# CHANGELOG

All versions follow the format `V<MAJOR>.<MONTH>-<UPDATE>` (e.g. `V1.09-01` = phase 1, September, update 01).
The version is stored once in `lib/app-info.ts` and displayed in the app footer.

## Unreleased

### Added
- A real owner account in front of PRV. Signing in at `/connexion` takes the owner's name, their email and a password; only then is the 4-digit code asked for. The two gates are separate: each has its own signed, `httpOnly`, `SameSite=Lax` cookie with its own audience (`prv_owner` and `prv_session`), so neither cookie can be presented as the other and neither secret is ever sufficient on its own. PRV pages require both, server-side, before any markup exists.
- `npm run prv:setup`, which writes the account and the code to `.env.local` as hashes. It prompts with the input hidden, confirms the password, generates the pepper and the session-signing key, and writes the file with mode `600` (already git-ignored). Re-running it is how the password or the code is changed. It also offers to set a private recovery phrase, hashed the same way as the other two credentials.
- The password and the code are now stored as peppered `scrypt.v1.<salt>.<hash>` values. The separator is a dot because the environment-file loader expands `$VAR` inside values, so a `scrypt$v1$...` value was silently truncated to `scrypt` and could never verify; the setup script now re-reads the file it wrote with the real loader and re-verifies all three secrets against it, so that class of bug cannot come back. The scrypt input is an HMAC keyed with `PRV_SECRET_PEPPER`, which lives only in the server environment. This matters most for the 4-digit code: there are only 10 000 of them, so an unpeppered hash would be exhausted in seconds. The pepper is required — if it is absent, PRV reports itself unconfigured rather than quietly verifying against something weak.
- Brute-force protection on both gates: ten attempts per five minutes per client, in front of a persistent budget — five wrong passwords lock the account for 15 minutes, three wrong codes lock the code for 15 minutes. A burst is absorbed by the rate limiter before any hashing happens, so a script cannot spend the server's CPU on guesses.
- The recovery phrase is now a peppered hash too, is only accepted once the account is signed in, and works in either hash format. It was already only a way back in from a code lockout; it is no longer a way to skip the password.

### Changed
- `PRV_ACCESS_CODE`, a plaintext environment variable, is no longer read at all. The code is `PRV_ACCESS_CODE_HASH` now, and the account adds `PRV_OWNER_USERNAME`, `PRV_OWNER_EMAIL` and `PRV_OWNER_PASSWORD_HASH`.
- Every protected API route, including the report PDF, now requires the account session as well as the code session. Previously the endpoints checked the code cookie alone, which would have made the account pointless: a copy of that one cookie, or the recovery phrase, would have reached every private endpoint on its own.
- Signing out now actually ends the session. It used to ask the browser to drop the cookies and nothing more, so a cookie captured beforehand stayed valid for its full 12 hours; a server-side cutoff timestamp now invalidates every token issued before the sign-out.
- `/connexion` moved out of the dashboard's route group into its own. It was rendering behind the app shell, which shows nothing until the browser has hydrated and then asks a first-time visitor to choose a filière — so a redirect out of PRV could land on the exam chooser instead of the sign-in form. The screen is now a standalone page with no sidebar and no onboarding in front of it.

### Removed
- The `Préparation` area, taken out of the web app: the sidebar entry, the mobile entry, the tab inside every OCS module, the hub page and the module cards. `/preparation` is no longer a route. Nothing was deleted from any Obsidian vault and the Obsidian integration itself is untouched.
- `Notes`, `Source / référence` and `Liens` from the task form. They were optional metadata that the task workflow never used; entering a task is now just a title, a description, a module, a date, a priority and a status. Values already stored on an existing task are preserved, so editing a task never destroys data.
- The `Partie / Chapitre` selector from the task form. Chapters themselves are untouched: the module chapters and their quizzes are unchanged, and only the ability to file a *task* under a chapter is gone.
- The example text that had been used as placeholder content (`Ex. Recherche OWASP`, the two OWASP URLs, `Ex. revoir la notion de chiffrement asymétrique`, `Ex. je veux consolider le module M203 cette semaine`). None of it was ever saved as data; the real OCS, OCC, ORS and EGTS content is unchanged.

### Fixed
- The status selector became unreadable in dark mode: white text on a white background. Form controls were painted with a translucent tint, and a native dropdown popup does not inherit the page background, so the browser composited the option list over its own light default. Controls now use an opaque `--field-surface` token derived from the existing theme variables, and every option state is set from those tokens, so the control follows the active theme. Dark mode is `rgb(10,10,10)` on white text, light mode is `rgb(245,245,245)` on black text, both well above the 4.5:1 contrast ratio, in the closed, hover, focus and open states.
- A task created without a module disappeared immediately after being created. The form sent an empty string where the store and the task list expect `null`, so the new task was filtered out of the OCS board. The store now normalises it, and the list tolerates the empty value so tasks saved before the fix reappear.

## V1.09-03

### Added
- `PRV` (espace privé OCS), a separate, self-authenticated area reachable from the OCS sidebar and mobile navigation only. It has its own layout and its own eight sections: Vue d'ensemble, Tâches, Obsidian, IA, Rapports, Analyse, Notifications, Paramètres privés.
- Real access control, since the app has no accounts: a 4-digit `PRV_ACCESS_CODE` exchanged for a signed, `httpOnly`, `SameSite=Lax` session lasting 12 hours, with three-attempt lockout for 15 minutes on both the code and the recovery phrase, and a recovery phrase to get back in. The lock is reversible rather than permanent.
- Weekly private reports computed from the real store: planning, completions, carryover, overdue (>14 days shown separately), per-module weighting by coefficient, chapter and objective progress, quiz results, journal points that need another pass, a transparent trajectory verdict and prioritised recommendations with their evidence. Regenerating a week is idempotent and increments a generation counter.
- Report PDF, rendered in memory and served only to an authenticated session that also presents the report's unguessable download id. Responses are `no-store`, and no PDF is written under `public/`.
- Optional server-side AI: editable task proposals that only reach the store after explicit confirmation, plus an interpretation of a stored report. Numbers are never produced by the model.
- Notifications: a work-free in-app reminder computed from real deadlines, and optional Web Push via a service worker.
- Private settings (report day, module weights, trend thresholds, AI toggle) stored server-side so a report generated by the cron obeys exactly the same rules as the screen.
- Private "to review" notes attached to a task, module or chapter.
- `npm run test:prv`, which starts a throwaway server on a real build and runs four suites: week-arithmetic and metrics unit tests, 134 black-box security checks (authorisation, brute force, cookie tampering, IDOR on report PDFs, cross-origin writes, cron secret handling, input sanitisation, secret disclosure), 43 browser checks (every section renders, the lockout and recovery flow, settings round-trip, the OCS-only rule), and 30 cross-exam checks confirming OCC, ORS and EGTS still work and never see PRV.
- `.env.example` documenting every PRV variable and how to generate each secret.

### Changed
- `app/` is now split into two root layouts, `(main)` and `(prv)`. This is a correctness fix, not cosmetics: `AppShell` renders nothing until the browser has hydrated, so *any* server component beneath it never runs. The PRV session check therefore had to live outside `AppShell` to be a real server-side check rather than a decorative one. Unauthenticated `/prv/...` URLs now answer with a genuine `307` redirect instead of a `200` page that only the client could resolve. Dashboard URLs are unchanged.

### Fixed
- The weekly completion rate could exceed 100%: the numerator counted every task finished during the week, including work that was never planned. It is now planned-and-done over planned, and the report shows the two figures separately. A module's own rate had the same flaw.
- Trajectory history points were all labelled with the current week instead of their own.
- Reports could not generate a PDF at all: webpack inlined `pdfkit` and its font metrics were then looked up inside the build directory. The package is now external.
- Snapshot tasks with a missing or unusable id all collapsed onto the same key.
- `PUSH_SUBJECT` defaulted to a made-up `mailto:admin@example.com`. Push now stays disabled until a real contact is configured.

### Notes
- PRV is OCS-only. Its data comes from the browser, since the server cannot read `localStorage`; the client filters to OCS modules and drops anything belonging to OCC, ORS or EGTS before posting.
- The weekly cron cannot read the store either, so it rebuilds from the latest snapshot the browser deposited and fails closed when there is none.
- The default recovery phrase is `Mimi` and is public. Set `PRV_RECOVERY_HASH` to replace it.
- `.prv-data/` must live on a persistent disk and the app must run as a single process. It is not suited to ephemeral or multi-instance serverless hosting.

## V1.09-02

### Added
- `Documents` tab for OCS modules, structured as:
  - `Cours`: every static material group except TP
  - `Activités`: the module's PDFs from `public/activities/<moduleId>` (part, title, date, size, inline preview, download)
  - `Fichiers / Updates`: files uploaded in `uploads/module-files/<moduleId>`
  - `Proger`: `TP` (static TP + `uploads/<moduleId>/tp`) and `Projets` (`uploads/<moduleId>/projects`), with a note that material may be added later
- Chapter-level quizzes: every chapter of an OCS module now has its own quiz panel with its own progress, instead of a single module-level quiz. Chapters without a question bank show the `Tsenaw Update` note.
- M201 chapter quiz split, reusing all 20 existing questions: ch-1 (7), ch-2 (7), ch-3 (6), ch-4 has no quiz.
- New task model with meaningful priorities (`Professeur` / `Important` / `Normal`), a status cycle (`À faire` / `En cours` / `Terminé`) and an automatic completion date.
- New `Tâches` tab on OCS modules: tasks created there are attached to the module automatically, plus an optional chapter.
- `Préparation` page listing the Obsidian structure `OCS → Module → Préparation` for every OCS module, with a `Préparation` entry in the sidebar and mobile navigation.
- `typecheck` script (`tsc --noEmit`) and an ESLint config so `npm run lint` runs non-interactively.

### Updated
- Dashboard now shows unfinished tasks first, grouped and sorted by priority, instead of a simple to-do list.
- OCS module pages: tabs are now `Aperçu`, `Les parties`, `Documents`, `Préparation`, `Notes`, `Tâches`.
- OCS `Les parties` shows each chapter's objectives and quiz side by side.
- Tasks are stored in `chapterQuizResults`-style per-scope keys, so a chapter result never overwrites a module-level one.
- Versioning: `V1.09-02`.

### Fixed
- Material categories are now matched case-insensitively, so a `TP` folder is correctly shown under `Proger` instead of `Cours`.
- Editing a task's status now stamps or clears its completion date, instead of only the inline status button doing so.
- The task priority colour rail now reflects the priority rather than the status.
- The `Proger` sections now state that the material can be added later, instead of leaving an unexplained empty area.
- The old module-level quiz score stays visible even after chapter quizzes are taken, so existing data is never silently hidden.
- `Préparation` navigation is only shown for the OCS option.
- OCC / ORS tasks keep their previous default priority (`medium`, now `Important pour moi`) and their day-based due date, so the old list behaves exactly as before.
- ESLint: renamed the reserved `module` variable in `app/modules/[id]/page.tsx` and escaped an apostrophe in `FilesSection`.

### Notes
- No user data was deleted. The persist store migrated from version 5 to version 6: legacy priorities map to the new ones (`high → prof`, `medium → important`, `low → normal`), legacy `completed` flags become the `completed` status, and module-level quiz results are kept and displayed as historical results.
- Obsidian is not configured, so no vault URL is generated. The page shows the target paths and an "À connecter" state instead of a broken link.
- OCC, ORS and EGTS modules keep their existing layout, progress logic and task list.

## V1.09-01

### Added
- OCS Activities section
- M201 activity PDFs
- OCS Quiz system
- 20-question M201 Quiz
- Quiz score and comprehension percentage
- "Tsenaw Update" for OCS modules without activities
- Help link
- Module completion behavior based on module hours
- EGTS module-hour progress logic

### Updated
- OCS module completion/progress behavior
- EGTS module progress behavior
- Versioning system: `V<MAJOR>.<MONTH>-<UPDATE>` format, centralized in `lib/app-info.ts` and displayed in the app footer
