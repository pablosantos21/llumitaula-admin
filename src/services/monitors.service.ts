import { supabase } from '../lib/supabase';

export interface Monitor {
    id: string;
    first_name: string;
    last_name: string;
    code?: string;
    created_at?: string;
}

export type Worker = Monitor;

export interface CreateMonitorResult {
    ok: boolean;
    monitor_id: string;
    user_id: string;
    email: string;
}

export const MonitorService = {
    getBySchool: async (schoolId: string): Promise<Monitor[]> => {
        const { data, error } = await supabase
            .from('monitors')
            .select(`
                id,
                first_name,
                last_name,
                code,
                created_at,
                monitors_schools!inner(school_id)
            `)
            .eq('monitors_schools.school_id', schoolId)
            .order('first_name');

        if (error) {
            console.error('Error fetching monitors:', error);
            throw new Error(error.message);
        }

        return (data || []).map(m => ({
            id: m.id,
            first_name: m.first_name || '',
            last_name: m.last_name || '',
            code: m.code != null ? String(m.code) : undefined,
            created_at: m.created_at,
        }));
    },

    getMonitorsBySchool: async (schoolId: string): Promise<Monitor[]> => {
        return MonitorService.getBySchool(schoolId);
    },

    createMonitor: async (
        monitor: Pick<Monitor, 'first_name' | 'last_name'> & { code: string },
        schoolId: string
    ): Promise<CreateMonitorResult> => {
        // The create_monitor RPC creates the auth user (email monitor.{code}@llumitaula.local
        // with the code as password), the public.users row with role 'monitor',
        // the monitors row and the link in monitors_schools.
        const { data, error } = await supabase.rpc('create_monitor', {
            p_first_name: monitor.first_name.trim(),
            p_last_name: monitor.last_name.trim(),
            p_code: Number(monitor.code),
            p_school_id: schoolId,
        });

        if (error) {
            console.error('Error creating monitor:', error);
            throw error;
        }

        return data as CreateMonitorResult;
    },

    updateMonitor: async (
        id: string,
        updates: Partial<Pick<Monitor, 'first_name' | 'last_name'>>
    ): Promise<Monitor> => {
        const cleanUpdates: Partial<Pick<Monitor, 'first_name' | 'last_name'>> = {};
        if (updates.first_name !== undefined) cleanUpdates.first_name = updates.first_name.trim();
        if (updates.last_name !== undefined) cleanUpdates.last_name = updates.last_name.trim();

        const { data, error } = await supabase
            .from('monitors')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating monitor:', error);
            throw new Error(error.message);
        }

        return data;
    },

    update: async (
        id: string,
        updates: Partial<Pick<Monitor, 'first_name' | 'last_name'>>
    ): Promise<Monitor> => {
        return MonitorService.updateMonitor(id, updates);
    },

    deleteMonitor: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('monitors')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting monitor:', error);
            throw new Error(error.message);
        }
    },

    delete: async (id: string): Promise<void> => {
        return MonitorService.deleteMonitor(id);
    },
};

export const WorkerService = MonitorService;
