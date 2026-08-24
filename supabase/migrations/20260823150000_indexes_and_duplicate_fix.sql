-- Fix remaining performance advisor warnings:
-- 1. Drop duplicate index on monitors (monitors_id_key duplicates monitors_pkey)
-- 2. Add covering indexes for unindexed foreign keys

ALTER TABLE public.monitors DROP CONSTRAINT IF EXISTS monitors_id_key;

CREATE INDEX IF NOT EXISTS child_allergens_allergen_id_idx ON public.child_allergens (allergen_id);
CREATE INDEX IF NOT EXISTS children_class_id_idx ON public.children (class_id);
CREATE INDEX IF NOT EXISTS classes_school_id_idx ON public.classes (school_id);
CREATE INDEX IF NOT EXISTS incidents_child_id_idx ON public.incidents (child_id);
CREATE INDEX IF NOT EXISTS incidents_monitor_id_idx ON public.incidents (monitor_id);
CREATE INDEX IF NOT EXISTS menus_schools_school_id_idx ON public.menus_schools (school_id);
CREATE INDEX IF NOT EXISTS monitors_schools_monitor_id_idx ON public.monitors_schools (monitor_id);
CREATE INDEX IF NOT EXISTS parents_children_child_id_idx ON public.parents_children (child_id);
