-- Scope supervisor classroom permissions to their assigned school.

-- ============ classes ==========
DROP POLICY IF EXISTS classes_insert ON public.classes;
DROP POLICY IF EXISTS classes_update ON public.classes;
DROP POLICY IF EXISTS classes_delete ON public.classes;
DROP POLICY IF EXISTS classes_supervisor_select ON public.classes;

CREATE POLICY classes_insert ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  );

CREATE POLICY classes_update ON public.classes
  FOR UPDATE TO authenticated
  USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  );

CREATE POLICY classes_delete ON public.classes
  FOR DELETE TO authenticated
  USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  );

CREATE POLICY classes_supervisor_select ON public.classes
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'supervisor'
    AND school_id = (
      SELECT u.school_id
      FROM public.users u
      WHERE u.id = (select auth.uid())
    )
  );

-- ============ schools ==========
DROP POLICY IF EXISTS schools_update ON public.schools;
DROP POLICY IF EXISTS schools_supervisor_select ON public.schools;

CREATE POLICY schools_update ON public.schools
  FOR UPDATE TO authenticated
  USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  );

CREATE POLICY schools_supervisor_select ON public.schools
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'supervisor'
    AND id = (
      SELECT u.school_id
      FROM public.users u
      WHERE u.id = (select auth.uid())
    )
  );

-- ============ children ==========
DROP POLICY IF EXISTS children_insert ON public.children;
DROP POLICY IF EXISTS children_update ON public.children;
DROP POLICY IF EXISTS children_supervisor_select ON public.children;

CREATE POLICY children_insert ON public.children
  FOR INSERT TO authenticated
  WITH CHECK (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = children.class_id
          AND c.school_id = (
            SELECT u.school_id
            FROM public.users u
            WHERE u.id = (select auth.uid())
          )
      )
    )
  );

CREATE POLICY children_update ON public.children
  FOR UPDATE TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = children.class_id
          AND c.school_id = (
            SELECT u.school_id
            FROM public.users u
            WHERE u.id = (select auth.uid())
          )
      )
    )
  )
  WITH CHECK (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = children.class_id
          AND c.school_id = (
            SELECT u.school_id
            FROM public.users u
            WHERE u.id = (select auth.uid())
          )
      )
    )
  );

CREATE POLICY children_supervisor_select ON public.children
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'supervisor'
    AND EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = children.class_id
        AND c.school_id = (
          SELECT u.school_id
          FROM public.users u
          WHERE u.id = (select auth.uid())
        )
    )
  );
