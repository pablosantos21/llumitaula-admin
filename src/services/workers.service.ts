import { supabase } from '../lib/supabase';

export interface Worker {
    id: string;
    full_name: string;
}

export const WorkerService = {
    getBySchool: async (schoolId: string): Promise<Worker[]> => {
        const { data, error } = await supabase
            .from('monitors')
            .select('id,first_name,last_name,monitors_schools!inner(school_id)')
            .eq('monitors_schools.school_id', schoolId)
            .order('first_name');

        if (error) throw new Error(error.message);

        return (data || []).map(m => ({
            id: m.id,
            full_name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Sin nombre',
        }));
    },

    update: async (id: string, updates: Pick<Worker, 'full_name'>): Promise<void> => {
        const parts = updates.full_name.trim().split(/\s+/);
        const first_name = parts[0] || '';
        const last_name = parts.slice(1).join(' ') || '';
        const { error } = await supabase.from('monitors').update({ first_name, last_name }).eq('id', id);
        if (error) throw new Error(error.message);
    },
};
