# Supabase Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 6 security warnings from Supabase security advisor by implementing proper RLS policies, securing functions, and enabling password protection.

**Architecture:** This plan implements security fixes in layers:
1. Fix the `custom_access_token_hook` function (search_path + SECURITY DEFINER restrictions)
2. Revoke default role permissions and implement proper Row-Level Security (RLS) policies for all tables
3. Enable leaked password protection in Auth settings

**Tech Stack:** Supabase PostgreSQL, RLS policies, Auth configuration

---

## Context

**Current Security Issues:**
1. `custom_access_token_hook` function has mutable search_path
2. 11 tables exposed to GraphQL for both `anon` and `authenticated` roles
3. `custom_access_token_hook` executable by both `anon` and `authenticated` without restrictions
4. Leaked password protection disabled

**Current RLS State:** All tables have RLS enabled but currently rely on default role grants (which is why they're exposed)

**User Roles:** admin, monitor, padre (parent)

---

## Task 1: Fix custom_access_token_hook Function (Search Path & SECURITY DEFINER)

**Files:**
- Modify: Database function via migration

**Steps:**

- [ ] **Step 1: Create migration for function search_path fix**

Run: `supabase migration new fix_custom_access_token_hook_search_path`

This creates a new migration file.

- [ ] **Step 2: Write migration SQL to fix search_path and restrict permissions**

The migration should:
1. Modify the function to set explicit search_path
2. Revoke EXECUTE from anon and authenticated roles
3. Grant EXECUTE only to postgres (internal auth use)

Migration SQL:
```sql
-- Fix search_path vulnerability
ALTER FUNCTION public.custom_access_token_hook(event jsonb) 
SET search_path = public;

-- Revoke public access
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) FROM authenticated;

-- Ensure only postgres can execute (used by auth internally)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) TO postgres;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors, function now has explicit search_path

- [ ] **Step 4: Verify the fix**

Run: 
```sql
SELECT proname, prosecdef, 
       (SELECT string_agg(grantee, ', ') 
        FROM information_schema.role_routine_grants 
        WHERE routine_name = 'custom_access_token_hook') as granted_to
FROM pg_proc WHERE proname = 'custom_access_token_hook';
```

Expected: Function shows SECURITY DEFINER but should only be in postgres grants

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "fix: secure custom_access_token_hook function

- Set explicit search_path to prevent privilege escalation
- Revoke EXECUTE permissions from anon and authenticated roles
- Only postgres (auth internal) can execute this SECURITY DEFINER function"
```

---

## Task 2: Implement RLS Policies - Users Table

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for users table RLS policies**

Run: `supabase migration new add_rls_policies_users_table`

- [ ] **Step 2: Write migration with RLS policies for users table**

The users table contains sensitive user data. Policies:
- Users can view their own profile
- Admins can view all users
- Monitors cannot view user list (they view monitors_schools relationships only)
- Parents can only view their own profile (security: they can't see other parent data)

Migration SQL:
```sql
-- Create RLS policies for users table
-- Policy 1: Users can view their own profile
CREATE POLICY "users_view_own_profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Policy 2: Admins can view all users
CREATE POLICY "users_admin_view_all" ON public.users
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Policy 3: Users can update their own profile (non-role fields)
CREATE POLICY "users_update_own_profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    -- Users cannot change their own role (only admins can)
    auth.uid() = id AND role = (SELECT role FROM public.users WHERE id = auth.uid())
  );

-- Policy 4: Admins can update any user
CREATE POLICY "users_admin_update" ON public.users
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Ensure anon and authenticated cannot select by default
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Verify policies**

Run:
```sql
SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'users';
```

Expected: Should show 4 policies for users table

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for users table

- Users can view and update their own profile
- Admins can view and update all users
- Prevent role escalation in update policies"
```

---

## Task 3: Implement RLS Policies - Children Table

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for children table RLS policies**

Run: `supabase migration new add_rls_policies_children_table`

- [ ] **Step 2: Write migration with RLS policies for children table**

Children data should be visible to:
- Parents who have a relationship to the child
- Monitors of schools where the child is in a class
- Admins

Migration SQL:
```sql
-- Create RLS policies for children table
-- Policy 1: Parents can view children they're linked to
CREATE POLICY "children_view_own_children" ON public.children
  FOR SELECT USING (
    id IN (
      SELECT child_id FROM public.parents_children 
      WHERE parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view children in their schools
CREATE POLICY "children_view_monitor_schools" ON public.children
  FOR SELECT USING (
    class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.monitors_schools ms ON ms.school_id = c.school_id
      JOIN public.monitors m ON m.id = ms.monitor_id
      WHERE m.id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all children
CREATE POLICY "children_admin_view_all" ON public.children
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.children FROM anon, authenticated;
GRANT SELECT ON public.children TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for children table

- Parents can view their linked children
- Monitors can view children in their schools
- Admins can view all children"
```

---

## Task 4: Implement RLS Policies - Schools Table

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for schools table RLS policies**

Run: `supabase migration new add_rls_policies_schools_table`

- [ ] **Step 2: Write migration with RLS policies for schools table**

Schools data should be visible to:
- Monitors assigned to those schools
- Admins
- Parents (for discovery, but limited by children's school)

Migration SQL:
```sql
-- Create RLS policies for schools table
-- Policy 1: Monitors can view their assigned schools
CREATE POLICY "schools_view_monitor_assigned" ON public.schools
  FOR SELECT USING (
    id IN (
      SELECT school_id FROM public.monitors_schools
      WHERE monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 2: Parents can view schools where their children attend
CREATE POLICY "schools_view_parent_children_schools" ON public.schools
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT c.school_id FROM public.classes c
      WHERE c.id IN (
        SELECT child_id FROM public.parents_children pc
        JOIN public.children ch ON ch.id = pc.child_id
        WHERE pc.parent_id = auth.uid()
      )
    )
  );

-- Policy 3: Admins can view all schools
CREATE POLICY "schools_admin_view_all" ON public.schools
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.schools FROM anon, authenticated;
GRANT SELECT ON public.schools TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for schools table

- Monitors can view their assigned schools
- Parents can view schools of their children
- Admins can view all schools"
```

---

## Task 5: Implement RLS Policies - Classes Table

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for classes table RLS policies**

Run: `supabase migration new add_rls_policies_classes_table`

- [ ] **Step 2: Write migration with RLS policies for classes table**

Classes should be visible to:
- Parents whose children are in the class
- Monitors in the school
- Admins

Migration SQL:
```sql
-- Create RLS policies for classes table
-- Policy 1: Parents can view classes their children attend
CREATE POLICY "classes_view_parent_children_classes" ON public.classes
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT ch.class_id FROM public.children ch
      JOIN public.parents_children pc ON pc.child_id = ch.id
      WHERE pc.parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view classes in their schools
CREATE POLICY "classes_view_monitor_schools" ON public.classes
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM public.monitors_schools
      WHERE monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all classes
CREATE POLICY "classes_admin_view_all" ON public.classes
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.classes FROM anon, authenticated;
GRANT SELECT ON public.classes TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for classes table

- Parents can view classes their children attend
- Monitors can view classes in their schools
- Admins can view all classes"
```

---

## Task 6: Implement RLS Policies - Incidents Table

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for incidents table RLS policies**

Run: `supabase migration new add_rls_policies_incidents_table`

- [ ] **Step 2: Write migration with RLS policies for incidents table**

Incidents are sensitive data (behavioral/health incidents). Visibility:
- Parents can view incidents for their children
- Monitors can view incidents for children in their schools
- Admins can view all incidents

Migration SQL:
```sql
-- Create RLS policies for incidents table
-- Policy 1: Parents can view incidents for their children
CREATE POLICY "incidents_view_parent_children_incidents" ON public.incidents
  FOR SELECT USING (
    child_id IN (
      SELECT child_id FROM public.parents_children 
      WHERE parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view incidents for children in their schools
CREATE POLICY "incidents_view_monitor_school_children" ON public.incidents
  FOR SELECT USING (
    child_id IN (
      SELECT ch.id FROM public.children ch
      JOIN public.classes c ON c.id = ch.class_id
      JOIN public.monitors_schools ms ON ms.school_id = c.school_id
      WHERE ms.monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all incidents
CREATE POLICY "incidents_admin_view_all" ON public.incidents
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Policy 4: Monitors can insert incidents for children in their schools
CREATE POLICY "incidents_monitor_insert" ON public.incidents
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT ch.id FROM public.children ch
      JOIN public.classes c ON c.id = ch.class_id
      JOIN public.monitors_schools ms ON ms.school_id = c.school_id
      WHERE ms.monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Revoke default access
REVOKE SELECT ON public.incidents FROM anon, authenticated;
GRANT SELECT ON public.incidents TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for incidents table

- Parents can view incidents for their children
- Monitors can view/insert incidents for school children
- Admins can view all incidents"
```

---

## Task 7: Implement RLS Policies - Menus and Menus_Schools Tables

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for menus RLS policies**

Run: `supabase migration new add_rls_policies_menus_tables`

- [ ] **Step 2: Write migration with RLS policies for menus tables**

Menus are generally discoverable information. Policies:
- Anyone (authenticated) can view menus for schools they have access to
- Admins can view all menus
- Monitors and parents can view menus for their schools/children's schools

Migration SQL:
```sql
-- Create RLS policies for menus table
-- Policy 1: Parents can view menus for their children's schools
CREATE POLICY "menus_view_parent_school_access" ON public.menus
  FOR SELECT USING (
    id IN (
      SELECT m.id FROM public.menus m
      JOIN public.menus_schools ms ON ms.menu_id = m.id
      JOIN public.schools s ON s.id = ms.school_id
      WHERE s.id IN (
        SELECT DISTINCT c.school_id FROM public.classes c
        JOIN public.children ch ON ch.class_id = c.id
        JOIN public.parents_children pc ON pc.child_id = ch.id
        WHERE pc.parent_id = auth.uid()
      )
    )
  );

-- Policy 2: Monitors can view menus for their schools
CREATE POLICY "menus_view_monitor_schools" ON public.menus
  FOR SELECT USING (
    id IN (
      SELECT m.id FROM public.menus m
      JOIN public.menus_schools ms ON ms.menu_id = m.id
      WHERE ms.school_id IN (
        SELECT school_id FROM public.monitors_schools
        WHERE monitor_id IN (
          SELECT id FROM public.monitors 
          WHERE code IS NOT NULL
        )
      )
    )
  );

-- Policy 3: Admins can view all menus
CREATE POLICY "menus_admin_view_all" ON public.menus
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Create RLS policies for menus_schools table
-- Policy 1: Parents can view menu dates for their children's schools
CREATE POLICY "menus_schools_view_parent_access" ON public.menus_schools
  FOR SELECT USING (
    school_id IN (
      SELECT DISTINCT c.school_id FROM public.classes c
      JOIN public.children ch ON ch.class_id = c.id
      JOIN public.parents_children pc ON pc.child_id = ch.id
      WHERE pc.parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view menu dates for their schools
CREATE POLICY "menus_schools_view_monitor_schools" ON public.menus_schools
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM public.monitors_schools
      WHERE monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all menu_schools entries
CREATE POLICY "menus_schools_admin_view_all" ON public.menus_schools
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.menus FROM anon, authenticated;
REVOKE SELECT ON public.menus_schools FROM anon, authenticated;
GRANT SELECT ON public.menus TO authenticated;
GRANT SELECT ON public.menus_schools TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for menus and menus_schools tables

- Parents can view menus for their children's schools
- Monitors can view menus for their assigned schools
- Admins can view all menus"
```

---

## Task 8: Implement RLS Policies - Monitors and Monitors_Schools Tables

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for monitors RLS policies**

Run: `supabase migration new add_rls_policies_monitors_tables`

- [ ] **Step 2: Write migration with RLS policies for monitors tables**

Monitors data is sensitive. Policies:
- Monitors can view their own profile
- Admins can view all monitors
- Parents cannot view monitors list

Migration SQL:
```sql
-- Create RLS policies for monitors table
-- Policy 1: Monitors can view their own profile
CREATE POLICY "monitors_view_own_profile" ON public.monitors
  FOR SELECT USING (
    -- Monitor can view if their id is in the monitors table
    -- This requires monitors to be linked to auth users via separate mapping
    -- For now, admins only
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Policy 2: Admins can view all monitors
CREATE POLICY "monitors_admin_view_all" ON public.monitors
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Create RLS policies for monitors_schools table
-- Policy 1: Admins can view all monitor-school assignments
CREATE POLICY "monitors_schools_admin_view_all" ON public.monitors_schools
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.monitors FROM anon, authenticated;
REVOKE SELECT ON public.monitors_schools FROM anon, authenticated;
GRANT SELECT ON public.monitors TO authenticated;
GRANT SELECT ON public.monitors_schools TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for monitors and monitors_schools tables

- Admins can view all monitors and assignments
- Restrict monitor visibility to admin role only"
```

---

## Task 9: Implement RLS Policies - Parents_Children Table

**Files:**
- Modify: Database via migration

**Steps:**

- [ ] **Step 1: Create migration for parents_children RLS policies**

Run: `supabase migration new add_rls_policies_parents_children_table`

- [ ] **Step 2: Write migration with RLS policies for parents_children table**

Parents_children is a relationship table. Policies:
- Users can view their own relationships
- Admins can view all relationships

Migration SQL:
```sql
-- Create RLS policies for parents_children table
-- Policy 1: Parents can view their own children relationships
CREATE POLICY "parents_children_view_own_relationships" ON public.parents_children
  FOR SELECT USING (parent_id = auth.uid());

-- Policy 2: Admins can view all relationships
CREATE POLICY "parents_children_admin_view_all" ON public.parents_children
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.parents_children FROM anon, authenticated;
GRANT SELECT ON public.parents_children TO authenticated;
```

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for parents_children table

- Parents can view their own child relationships
- Admins can view all relationships"
```

---

## Task 10: Enable Leaked Password Protection in Auth

**Files:**
- Configuration in Supabase dashboard (manual step documented)

**Steps:**

- [ ] **Step 1: Access Supabase Auth settings**

Navigate to: https://app.supabase.com/project/[YOUR_PROJECT_ID]/auth/policies

- [ ] **Step 2: Find Password Security section**

Look for "Password strength and leaked password protection" or similar

- [ ] **Step 3: Enable "Check Leaked Passwords"**

Toggle the setting to enable password checking against HaveIBeenPwned

Expected: Setting shows "enabled" or similar confirmation

- [ ] **Step 4: Document the change**

Create a note file for manual changes:

```bash
mkdir -p docs/security/
cat > docs/security/auth-configuration.md << 'EOF'
# Auth Configuration

## Leaked Password Protection

**Enabled:** 2026-05-11
**Status:** Active

Supabase Auth now checks all new passwords against HaveIBeenPwned.org to prevent compromised password usage.

**Location in Dashboard:** Authentication → Policies → Password strength settings
EOF
```

- [ ] **Step 5: Verify and document**

After enabling, verify it appears in the Auth settings. Document completion in your security log.

Expected: Setting persists after save

- [ ] **Step 6: Commit documentation**

```bash
git add docs/security/
git commit -m "docs: enable and document leaked password protection

Leaked password protection is now active for all new user passwords.
Passwords are checked against HaveIBeenPwned.org database."
```

---

## Task 11: Verification and Testing

**Files:**
- Test queries to verify all changes

**Steps:**

- [ ] **Step 1: Verify all migrations applied**

Run: `supabase migration list`

Expected: All new migrations show as applied

- [ ] **Step 2: Verify RLS policies are in place**

Run:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

Expected: ~20+ policies across all tables, none for anon role

- [ ] **Step 3: Verify role permissions revoked**

Run:
```sql
SELECT table_name, privilege, grantee 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;
```

Expected: No SELECT grants for anon role; only authenticated with specific table grants

- [ ] **Step 4: Verify function security fixes**

Run:
```sql
SELECT proname, prosecdef,
  (SELECT string_agg(grantee || ':' || privilege_type, ', ')
   FROM information_schema.role_routine_grants
   WHERE routine_name = proname) as grants
FROM pg_proc 
WHERE proname = 'custom_access_token_hook';
```

Expected: Function marked SECURITY DEFINER, no grants to anon/authenticated

- [ ] **Step 5: Run security advisor again**

Run: `supabase_get_advisors type:security`

Expected: All 6 warnings resolved; 0 security warnings remaining

- [ ] **Step 6: Commit verification results**

```bash
git add -A
git commit -m "docs: verify all security fixes applied

All 6 security warnings from Supabase advisor have been resolved:
- custom_access_token_hook search_path secured
- custom_access_token_hook SECURITY DEFINER access restricted
- RLS policies implemented for all 11 tables
- Anon role SELECT permissions revoked
- Authenticated role restricted via RLS policies
- Leaked password protection enabled in Auth"
```

---

## Verification Checklist

Before claiming completion:

- [ ] All migrations applied successfully
- [ ] No errors in migration logs
- [ ] Supabase security advisor shows 0 security warnings
- [ ] RLS policies visible in `pg_policies`
- [ ] Anon role has no SELECT permissions on any table
- [ ] Auth leaked password protection enabled and verified
- [ ] Git commits created for each logical change
- [ ] Documentation updated with security changes
