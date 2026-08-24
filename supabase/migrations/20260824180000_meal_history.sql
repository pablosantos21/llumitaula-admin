CREATE OR REPLACE VIEW public.meal_history AS
SELECT 
    mr.id,
    mr.recorded_date AS meal_date,
    mt.name AS meal_type,
    mr.status AS rating,
    cl.id AS class_id,
    cl.name AS class_name,
    cl.school_id,
    mr.child_id,
    c.first_name AS child_first_name,
    c.last_name AS child_last_name,
    mr.recorded_by AS worker_id,
    mon.id AS monitor_id,
    mon.first_name AS monitor_first_name,
    mon.last_name AS monitor_last_name,
    mr.recorded_at
FROM meal_records mr
JOIN children c ON mr.child_id = c.id
JOIN classes cl ON c.class_id = cl.id
LEFT JOIN meal_types mt ON mr.meal_type_id = mt.id
LEFT JOIN monitors mon ON mr.recorded_by = mon.id;
