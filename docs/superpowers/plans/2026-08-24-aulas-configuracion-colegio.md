# Aulas y Configuración del Colegio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add soft-deactivated classroom management and school-name editing to the authorized administration panel.

**Architecture:** Persist classroom state with `classes.is_active`, expose focused service mutations, and build a page-specific CRUD UI under the existing dashboard layout. Keep inactive classrooms in administrative listings while passing only active classrooms to child-assignment forms. Use the existing admin route guard and Supabase RLS model.

**Tech Stack:** React 19, TypeScript, React Router, Supabase, Tailwind CSS, Vite, ESLint.

---

## Context and File Map

- Create `supabase/migrations/YYYYMMDDHHMMSS_add_classes_active.sql`: add the non-null `classes.is_active` column with default `true`.
- Modify `src/services/classes.service.ts`: include active state and add update/state methods.
- Modify `src/services/schools.service.ts`: add school-name update.
- Create `src/pages/school/classes/ClassesPage.tsx`: list and manage classrooms and school name.
- Modify `src/App.tsx`: register `/school/:schoolId/classes` under the existing `AdminRoute`.
- Modify `src/layouts/DashboardLayout.tsx`: add the Aulas navigation item.
- Modify `src/pages/school/children/ChildrenPage.tsx`: provide active classrooms to assignment modals.
- Modify `src/pages/school/children/components/AddChildModal.tsx` and `EditChildModal.tsx` only if filtering is not centralized in `ChildrenPage`.
- Verify with `npm run build`, targeted ESLint, and the existing repository lint result.

## Task 1: Add Classroom Active State

**Files:**
- Create: `supabase/migrations/20260824100000_add_classes_active.sql`
- Modify: `src/services/classes.service.ts:3-50`

- [ ] **Step 1: Create the migration**

Add the following SQL:

```sql
ALTER TABLE public.classes
ADD COLUMN is_active boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Extend the Class type and query**

Update `Class` to include `is_active: boolean` and change `getClassesBySchool` to select `id, name, school_id, is_active`, ordered by name. Keep the existing school filter and error behavior.

- [ ] **Step 3: Add focused service mutations**

Add these methods to `ClassService`:

```ts
updateClass: async (id: string, name: string): Promise<Class> => {
    const { data, error } = await supabase
        .from('classes')
        .update({ name })
        .eq('id', id)
        .select('id, name, school_id, is_active')
        .single()

    if (error) throw new Error(error.message)
    return data
},

setClassActive: async (id: string, isActive: boolean): Promise<Class> => {
    const { data, error } = await supabase
        .from('classes')
        .update({ is_active: isActive })
        .eq('id', id)
        .select('id, name, school_id, is_active')
        .single()

    if (error) throw new Error(error.message)
    return data
}
```

- [ ] **Step 4: Apply and verify the migration locally or through the project migration workflow**

Run: `supabase db push`

Expected: the migration applies without errors and existing classrooms have `is_active = true`.

- [ ] **Step 5: Verify compilation and commit**

Run: `npm run build`

```bash
git add supabase/migrations/20260824100000_add_classes_active.sql src/services/classes.service.ts
git commit -m "feat: add classroom active state"
```

## Task 2: Add School Name Mutation

**Files:**
- Modify: `src/services/schools.service.ts:3-56`

- [ ] **Step 1: Add `updateSchoolName`**

Implement:

```ts
updateSchoolName: async (id: string, name: string): Promise<School> => {
    const { data, error } = await supabase
        .from('schools')
        .update({ name })
        .eq('id', id)
        .select('id, name')
        .single()

    if (error) throw new Error(error.message)
    return data
}
```

- [ ] **Step 2: Verify and commit**

Run: `npm run build`

```bash
git add src/services/schools.service.ts
git commit -m "feat: allow updating school name"
```

## Task 3: Build Classroom Management Page

**Files:**
- Create: `src/pages/school/classes/ClassesPage.tsx`

- [ ] **Step 1: Implement initial loading and state**

Load `SchoolService.getSchoolById(schoolId)` and `ClassService.getClassesBySchool(schoolId)` in one effect. Track `school`, `classes`, `isLoading`, `error`, modal state, selected class, and mutation state. Render an accessible loading status and an error message when the initial request fails.

- [ ] **Step 2: Implement school-name editing**

Render the current school name with an edit action. Submit a trimmed non-empty name through `SchoolService.updateSchoolName`, update local state with the returned school, close the form on success, and keep it open on failure.

- [ ] **Step 3: Implement classroom create and edit**

Add a `Nueva aula` action and modal form. Use `ClassService.createClass(name, schoolId)` for creation and `ClassService.updateClass(id, name)` for editing. Trim names, reject empty values, update local state, and disable controls while saving.

- [ ] **Step 4: Implement active-state actions**

Show an explicit active/inactive badge for every classroom. Use a confirmation modal before calling `setClassActive(class.id, !class.is_active)`. Keep the row visible after the mutation and update only its state.

- [ ] **Step 5: Verify page behavior and commit**

Run: `npx eslint src/pages/school/classes/ClassesPage.tsx`

Run: `npm run build`

```bash
git add src/pages/school/classes/ClassesPage.tsx
git commit -m "feat: add classroom administration page"
```

## Task 4: Register and Link the Page

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Register the protected route**

Import `ClassesPage` and add this child to the existing `/school/:schoolId` route inside `AdminRoute`:

```tsx
<Route path="classes" element={<ClassesPage />} />
```

- [ ] **Step 2: Add the navigation item**

Import `School` or `Chalkboard` from `lucide-react` and add:

```ts
{ name: 'Aulas', href: `/school/${schoolId}/classes`, icon: School }
```

Keep the existing `isAdmin` conditional around desktop and mobile navigation.

- [ ] **Step 3: Verify route and commit**

Run: `npx eslint src/App.tsx src/layouts/DashboardLayout.tsx`

Run: `npm run build`

```bash
git add src/App.tsx src/layouts/DashboardLayout.tsx
git commit -m "feat: link classroom administration route"
```

## Task 5: Exclude Inactive Classrooms from Assignments

**Files:**
- Modify: `src/pages/school/children/ChildrenPage.tsx:23-40`
- Modify: `src/pages/school/children/components/AddChildModal.tsx:18-91`
- Modify: `src/pages/school/children/components/EditChildModal.tsx:20-102`

- [ ] **Step 1: Filter assignment options at the page boundary**

After loading classes, derive `activeClasses = classes.filter((classItem) => classItem.is_active)`. Pass `activeClasses` to both `AddChildModal` and `EditChildModal`. Keep the complete `classes` list available only for administrative display or existing-child context if needed.

- [ ] **Step 2: Preserve an existing inactive assignment during editing**

When editing a child whose current class is inactive, include that current class as a temporary option so the form does not lose the existing value. Do not make other inactive classes selectable. The option must be marked as inactive in its label.

- [ ] **Step 3: Verify assignment behavior and commit**

Run: `npx eslint src/pages/school/children/ChildrenPage.tsx src/pages/school/children/components/AddChildModal.tsx src/pages/school/children/components/EditChildModal.tsx`

Run: `npm run build`

Manual checks:

- New child forms show only active classrooms.
- Existing child on an inactive classroom retains its current selection while editing.
- Reactivated classrooms become available again after reload.

```bash
git add src/pages/school/children/ChildrenPage.tsx src/pages/school/children/components/AddChildModal.tsx src/pages/school/children/components/EditChildModal.tsx
git commit -m "feat: exclude inactive classrooms from assignments"
```

## Final Verification

- [ ] Run `npm run build` and confirm it passes.
- [ ] Run targeted ESLint for every modified TypeScript file and confirm no new errors.
- [ ] Run `npm run lint`; record existing unrelated failures without changing unrelated files.
- [ ] Verify the migration is present and `is_active` defaults to `true`.
- [ ] Verify create, edit, deactivate, reactivate, and school-name editing through the UI.
- [ ] Update issue #3 with the verification result and close it only after all checks pass.
