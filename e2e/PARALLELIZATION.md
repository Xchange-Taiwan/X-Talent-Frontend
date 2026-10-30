# E2E parallelization

## Execution classes

| Class                          | Projects                                                                                                    | CI strategy                                           | Data policy                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| Browser-mocked / read-only SSR | `chromium-onboarding`, `chromium-anon`, `chromium-profile`, `chromium-reservation`, `chromium-notification` | 4 workers                                             | Browser mutations are mocked; SSR still reads the deployed backend |
| Read-only backend              | `chromium-backend-readonly`                                                                                 | Runs with the real-backend job, one worker by default | Reads seeded dev accounts; does not create test records            |
| Stateful backend               | `setup`, `chromium`, `setup-canary`, `chromium-canary`                                                      | One worker                                            | Uses shared authenticated accounts and canary cleanup              |

These suites are not fully backend-isolated. Browser interception cannot mock server-side requests. Profile, catalog, and mentor-pool SSR still require the dev backend. Signed sessions require `NEXTAUTH_SECRET` to match the target deployment; the workflow supplies `NEXTAUTH_SECRET_DEV`, so custom target URLs must use that secret too.

## Spec inventory

Paths below are relative to `e2e/tests`.

| Specs                                                                                                             | Classification                     | Dependencies                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `onboarding/onboarding.spec.ts`                                                                                   | Browser-mocked / read-only backend | SSR catalog                                                            |
| `public/email-verify.spec.ts`, `public/password-forgot.spec.ts`, `public/signin.spec.ts`, `public/signup.spec.ts` | Browser-mocked                     | Browser auth actions mocked                                            |
| `public/navigation.spec.ts`, `public/mentor-pool.spec.ts`                                                         | Read-only backend + browser mocks  | SSR mentor search/catalog; browser search mocked                       |
| `profile/profile-edit.spec.ts`                                                                                    | Browser-mocked / read-only backend | SSR catalog; profile writes mocked                                     |
| `profile/schedule-sync.spec.ts`                                                                                   | Browser-mocked / read-only backend | Seeded mentor profile/catalog SSR; schedule writes mocked              |
| `profile/profile-view.spec.ts`                                                                                    | Read-only backend                  | Seeded mentor/mentee profiles                                          |
| `reservation/reservation-create.spec.ts`, `reservation/reservation-booking-then-return.spec.ts`                   | Browser-mocked / read-only backend | Seeded profile SSR; reservation writes mocked                          |
| `reservation/header-notification-keyboard-nav.spec.ts`                                                            | Browser-mocked / read-only backend | Mentor-pool SSR; notification actions mocked                           |
| `reservation/reservation-mentee.spec.ts`, `reservation/reservation-mentor.spec.ts`                                | Browser-mocked                     | Reservation lists and writes mocked                                    |
| `notification/notification-center.spec.ts`                                                                        | Browser-mocked                     | Notification reads and writes mocked                                   |
| `authenticated/smoke.spec.ts`, `canary/dual-role-login.spec.ts`                                                   | Read-only authenticated backend    | Real authentication setup and shared accounts                          |
| `canary/mentor-reservation-notification.spec.ts`                                                                  | Stateful backend                   | Real availability, reservation, notification, cancellation and cleanup |

Authentication setup also performs real login requests. Global setup may warm the auth backend even for browser-mocked suites.

## Worker configuration

Local runs use six workers by default. The mock CI job passes `--workers=4`. CI real-backend runs retain one worker until test data is isolated per run.

The real-backend job waits for the browser-mocked job, even if the latter fails, so canary mutations do not overlap its SSR reads. Workflow-level concurrency prevents overlapping workflow runs against shared accounts without cancelling active cleanup. This does not lock out manual local runs or other systems; coordinate those separately. GitHub may replace a pending run when another run queues.

HTML reports remain separate artifacts: `playwright-report` and `playwright-report-real`.

`schedule-sync.spec.ts`, `reservation-create.spec.ts`, and `reservation-booking-then-return.spec.ts` remain in the single-worker backend project. Four-worker trials intermittently failed to find booking settings or the frozen calendar date. Their business writes are mocked, but seeded profile SSR dependencies are not isolated. Moving them avoids claiming that retries establish safe parallel execution.

## Enabling backend parallelism

Before increasing workers for real-backend or canary projects:

- Allocate independent accounts or tenant data per worker.
- Add a run and worker identifier to every created reservation, availability slot, and notification assertion.
- Scope cleanup to records created by that run and worker.
- Verify that authentication setup and cleanup remain independent between workers.
- Run repeated parallel trials and compare failures against a serial baseline.
