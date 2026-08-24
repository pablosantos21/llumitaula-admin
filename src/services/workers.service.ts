import { supabase } from '../lib/supabase';

export type WorkerRole = 'worker' | 'monitor' | 'supervisor';

export interface Worker {
    id: string;
    full_name: string;
    role: WorkerRole;
    active: boolean;
    school_id: string;
    worker_classrooms?: { class_id: string }[];
}

const roleOrMonitor = (role: unknown): WorkerRole =>
    role === 'worker' || role === 'supervisor' || role === 'monitor' ? role : 'monitor';

export const WorkerService = {
    getBySchool: async (schoolId: string): Promise<Worker[]> => {
        const { data, error } = await supabase
            .from('users')
            .select('id,full_name,role,active,school_id,worker_classrooms(class_id)')
            .eq('school_id', schoolId)
            .in('role', ['worker', 'monitor', 'supervisor'])
            .order('full_name');

        if (error) throw new Error(error.message);
        return (data || []).map(worker => ({
            ...worker,
            full_name: worker.full_name || 'Sin nombre',
            role: roleOrMonitor(worker.role),
            active: worker.active ?? true,
        })) as Worker[];
    },

    update: async (id: string, updates: Pick<Worker, 'full_name' | 'role' | 'active'>): Promise<void> => {
        const { error } = await supabase.from('users').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    },

    setClassrooms: async (workerId: string, classIds: string[]): Promise<void> => {
        const { error: deleteError } = await supabase
            .from('worker_classrooms')
            .delete()
            .eq('worker_id', workerId);
        if (deleteError) throw new Error(deleteError.message);

        if (classIds.length === 0) return;
        const { error: insertError } = await supabase
            .from('worker_classrooms')
            .insert(classIds.map(classId => ({ worker_id: workerId, class_id: classId })));
        if (insertError) throw new Error(insertError.message);
    },
};
