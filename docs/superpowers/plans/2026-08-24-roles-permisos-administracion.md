# Roles y Permisos de Administración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `supervisor` role and protect all administration routes so only `admin` and `supervisor` users can access them.

**Architecture:** Keep `ProtectedRoute` responsible for authentication and add a separate `AdminRoute` guard for authorization. Centralize the role predicate in the auth context so route protection and navigation use the same rule. Preserve the existing Supabase metadata source and provide a safe fallback for unknown roles.

**Tech Stack:** React 19, TypeScript, React Router, Supabase Auth, Vite, ESLint.

---

## Context and File Map

- Modify `src/services/auth.service.ts`: expand the user-role type and normalize roles returned by login, session recovery, and auth events.
- Modify `src/contexts/AuthContext.tsx`: expose `isAdmin` for the shared authorization predicate.
- Modify `src/App.tsx`: add an authorization guard and group administration routes under it.
- Modify `src/layouts/DashboardLayout.tsx`: hide administration navigation when the current user lacks permission.
- Verify `npm run build` and `npm run lint`; this repository currently has no test runner configured, so validation uses the compiler, linter, and direct route behavior checks.

## Task 1: Model and Normalize Roles

**Files:**
- Modify: `src/services/auth.service.ts:3-63`

- [ ] **Step 1: Define one role type and a normalizer**

Replace the duplicated role casts with an exported role type and a small normalizer. Unknown metadata must not become an authorized role.

```ts
export type UserRole = 'admin' | 'supervisor' | 'monitor'

const normalizeRole = (role: unknown): UserRole => {
    if (role === 'admin' || role === 'supervisor' || role === 'monitor') {
        return role
    }

    return 'monitor'
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}
```

- [ ] **Step 2: Use the normalizer for every Supabase user mapping**

In `login`, `getCurrentUser`, and `onAuthStateChange`, replace each metadata cast with:

```ts
role: normalizeRole(data.user.user_metadata?.role)
```

Use `user.user_metadata?.role` for `getCurrentUser` and `session.user.user_metadata?.role` for the auth-state callback. Keep all other mapping behavior unchanged.

- [ ] **Step 3: Verify the role model compiles**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 4: Commit the isolated role-model change**

```bash
git add src/services/auth.service.ts
git commit -m "feat: support supervisor user role"
```

## Task 2: Expose the Authorization Predicate

**Files:**
- Modify: `src/contexts/AuthContext.tsx:6-14,66-68`

- [ ] **Step 1: Extend the context contract**

Add `isAdmin: boolean` to `AuthContextType`.

- [ ] **Step 2: Derive the predicate from the normalized role**

Update the provider value to expose:

```tsx
isAdmin: user?.role === 'admin' || user?.role === 'supervisor'
```

Do not infer authorization from authentication status or from route names.

- [ ] **Step 3: Verify all context consumers compile**

Run: `npm run build`

Expected: The existing consumers compile without requiring unrelated changes.

- [ ] **Step 4: Commit the context contract change**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: expose admin authorization state"
```

## Task 3: Protect Administration Routes

**Files:**
- Modify: `src/App.tsx:1-47`

- [ ] **Step 1: Add the authorization guard**

Import `ReactNode` only if needed by the implementation and add this component below `ProtectedRoute`:

```tsx
function AdminRoute() {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return <Navigate to="/select-school" replace />
  }

  return <Outlet />
}
```

- [ ] **Step 2: Nest existing administration routes under the guard**

Keep `/`, `/select-school`, and `/menus` under `ProtectedRoute`. Place `/menus/:menuId` and `/school/:schoolId` under a nested `AdminRoute`, preserving the existing dashboard child routes and redirects.

The resulting route shape must preserve these paths for authorized users:

```tsx
<Route element={<AdminRoute />}>
  <Route path="/menus/:menuId" element={<SpecialMenuPage />} />
  <Route path="/school/:schoolId" element={<DashboardLayout />}>
    <Route index element={<Navigate to="monitors" replace />} />
    <Route path="monitors" element={<MonitorsPage />} />
    <Route path="children" element={<ChildrenPage />} />
    <Route path="incidences" element={<IncidentsPage />} />
  </Route>
</Route>
```

- [ ] **Step 3: Verify route behavior**

Run: `npm run build`

Manual checks with authenticated sessions:

- `admin` reaches `/school/<id>/monitors`.
- `supervisor` reaches `/school/<id>/monitors`.
- `monitor` is redirected to `/select-school` when opening that URL directly.
- Unauthenticated users are still redirected to `/login`.

- [ ] **Step 4: Commit the route guard**

```bash
git add src/App.tsx
git commit -m "feat: protect administration routes by role"
```

## Task 4: Hide Unauthorized Navigation

**Files:**
- Modify: `src/layouts/DashboardLayout.tsx:1-56,75-101,145-165`

- [ ] **Step 1: Read the shared authorization state**

Change the `useAuth` destructuring to include `isAdmin`:

```tsx
const { user, logout, isAdmin } = useAuth()
```

- [ ] **Step 2: Avoid rendering administration links for unauthorized users**

Render the existing `navigation` links only when `isAdmin` is true in both desktop and mobile navigation. Keep the back-to-panel link and logout behavior unchanged.

- [ ] **Step 3: Verify UI and final checks**

Run: `npm run lint`

Expected: ESLint completes with no errors.

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

Manual checks:

- `admin` and `supervisor` see the same administration links.
- `monitor` sees no administration links.
- A `monitor` cannot bypass the restriction by entering an administration URL directly.

- [ ] **Step 4: Commit the navigation change**

```bash
git add src/layouts/DashboardLayout.tsx
git commit -m "feat: hide admin navigation from monitors"
```

## Final Verification

- [ ] Run `npm run lint` and confirm it passes.
- [ ] Run `npm run build` and confirm it passes.
- [ ] Inspect `git diff main~4..HEAD -- src/services/auth.service.ts src/contexts/AuthContext.tsx src/App.tsx src/layouts/DashboardLayout.tsx` and confirm only role normalization, authorization, route protection, and navigation visibility changed.
- [ ] Update issue #2 with the verification result and close it only after the checks pass.
