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
    class_name: string;
    child_id: string;
    child_first_name: string;
    child_last_name: string;
    worker_id: string | null;
    monitor_first_name: string | null;
    monitor_last_name: string | null;
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
                class_name,
                child_id,
                child_first_name,
                child_last_name,
                worker_id,
                monitor_first_name,
                monitor_last_name
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
