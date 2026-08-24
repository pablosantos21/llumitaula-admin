import { supabase } from '../lib/supabase';

export type MealHistoryFilters = {
    date?: string;
    classId?: string;
    childId?: string;
    workerId?: string;
    mealType?: string;
    rating?: string;
};

export interface MealHistoryRecord {
    id: string;
    meal_date: string;
    meal_type: string;
    rating: number | null;
    class_id: string;
    child_id: string;
    worker_id: string | null;
    classes: { id: string; name: string };
    children: { id: string; first_name: string; last_name: string };
    worker: { id: string; full_name: string | null } | null;
}

export const MealHistoryService = {
    getBySchool: async (schoolId: string, filters: MealHistoryFilters = {}): Promise<MealHistoryRecord[]> => {
        let query = supabase
            .from('meal_history')
            .select(`
                id,
                meal_date,
                meal_type,
                rating,
                class_id,
                child_id,
                worker_id,
                classes!inner(id, name),
                children!inner(id, first_name, last_name),
                worker:users!meal_history_worker_id_fkey(id, full_name)
            `)
            .eq('school_id', schoolId)
            .order('meal_date', { ascending: false });

        if (filters.date) query = query.eq('meal_date', filters.date);
        if (filters.classId) query = query.eq('class_id', filters.classId);
        if (filters.childId) query = query.eq('child_id', filters.childId);
        if (filters.workerId) query = query.eq('worker_id', filters.workerId);
        if (filters.mealType) query = query.eq('meal_type', filters.mealType);
        if (filters.rating) query = query.eq('rating', Number(filters.rating));

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return (data as unknown as MealHistoryRecord[]) || [];
    },
};
