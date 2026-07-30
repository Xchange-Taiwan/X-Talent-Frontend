# X-Talent Common CI & AI Review Fixes

This reference documents the most common pipeline issues and AI review blockages in the X-Talent-Frontend repository and provides their standard, idiomatic resolutions.

---

## 1. Type Assertion Errors & Mocking (Shoehorn)

### Problem

Type check fails or test data breaks because complex types (e.g., Session, User, Mentor profile) require dozens of fields, and developers are using risky `as any` or `as User` type assertions.

### Standard Rule

**Strictly prohibit `as any` or `as ComplexType` assertions in tests.** Use `@total-typescript/shoehorn` for type-safe partial mocking.

### Solution

Import `fromPartial` to safely mock only the required subset of a type:

```typescript
import { fromPartial } from '@total-typescript/shoehorn';
import { User } from '@/types';

// ✅ Correct: Type-safe partial mock
const mockUser = fromPartial<User>({
  id: 'user-123',
  name: 'John Doe',
});
```

For cases where you specifically want to pass an invalid type to trigger error handling, use `fromAny`:

```typescript
import { fromAny } from '@total-typescript/shoehorn';

// ✅ Correct: Type-safe bypass for error testing
const invalidData = fromAny({ invalidField: true });
```

---

## 2. Depth Boundary (Deep Modules) Violations

### Problem

AI reviewer or local dependency rules detect imports of React, Next navigation, hooks, or UI components within `src/lib/**` or `src/services/**`.

### Standard Rule

To maintain loose coupling and deep modules, `src/lib/**` (except pure frontend UI helpers) and `src/services/**` **must not** directly depend on:

- React hooks/state
- `next/navigation` (router, pathname, etc.)
- `next-auth/react`
- `@/hooks/**`
- Any UI component or layout

### Solution

Refactor the function or class to receive these dependencies dynamically as parameters, configurations, or callback functions:

```typescript
// ❌ Incorrect: Service directly accessing router/pathname
import { useRouter } from 'next/navigation';
export function fetchProfileAndRedirect(id: string) {
  const router = useRouter(); // Causes violation!
  // ...
}

// ✅ Correct: Inject callbacks instead
export function fetchProfileAndHandle(
  id: string,
  onRedirect: (url: string) => void
) {
  // ...
  onRedirect(`/profile/${id}`);
}
```

---

## 3. Zod Schema & Form Hook Patterns

### Problem

Forms fail validation, use redundant state, or bypass validation schema rules.

### Standard Rule

Every form component must use:

1. A Zod schema defined in `src/schemas/`
2. A custom hook in `src/hooks/` named `use<Name>Form` utilizing `@hookform/resolvers/zod`

### Solution

Ensure the form hooks and components are wired up together:

```typescript
// src/schemas/profile.ts
import { z } from 'zod';
export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

// src/hooks/useProfileForm.ts
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema } from '@/schemas/profile';

export function useProfileForm() {
  return useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '' },
  });
}
```

---

## 4. Storybook Router/Session Mocking

### Problem

Storybook build (`pnpm run build-storybook`) fails or stories crash at runtime due to missing Next.js router context or `useSession` provider context.

### Standard Rule

All Storybook stories requiring router or authentication context **must** be wrapped in the `withAppContext` decorator.

### Solution

Register `withAppContext` as a decorator or pass parameters/args to mock the state:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
};
export default meta;

type Story = StoryObj<typeof MyComponent>;

// ✅ Mock authenticated state
export const Authenticated: Story = {
  parameters: {
    auth: {
      status: 'authenticated',
      session: { user: { id: '1', name: 'Jane' } },
    },
  },
};
```

---

## 5. Prettier & ESLint Quality Failures

### Problem

Prettier or ESLint formatting and rule assertions block the CI build.

### Solution

Run auto-fixing scripts locally first before pushing:

- Run format: `pnpm run format`
- Run lint fix: `pnpm run lint:fix`
- Perform standard code health check: `pnpm run lint:check`

---

## 6. Sentry & Analytics PII Leaks

### Problem

Logging or analytics methods leak Personally Identifiable Information (PII) such as email, passwords, tokens, real addresses, etc.

### Standard Rule

Never record, log, or track PII.

### Solution

Redact or strip any sensitive properties from payload logs before sending to `monitoring.ts` or `analytics.ts`:

```typescript
// ❌ Incorrect
trackEvent('user_login', { email: user.email, token: user.token });

// ✅ Correct
trackEvent('user_login', { userId: user.id });
```
