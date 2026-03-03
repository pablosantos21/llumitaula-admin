import { supabase } from '../lib/supabase';

export interface Monitor {
    id: string;
    first_name: string;
    last_name: string;
    code: string;
    created_at: string;
}

export const MonitorService = {
    getMonitorsBySchool: async (schoolId: string): Promise<Monitor[]> => {
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

        // The query returns monitors with the junction table inside, we just return the monitor data
        return data || [];
    },

    createMonitor: async (monitor: Omit<Monitor, 'id' | 'created_at'>, schoolId: string): Promise<Monitor> => {
        // First create the monitor
        const { data: newMonitor, error: monitorError } = await supabase
            .from('monitors')
            .insert([monitor])
            .select()
            .single();

        if (monitorError) {
            console.error('Error creating monitor:', monitorError);
            throw new Error(monitorError.message);
        }

        // Then link it to the school
        const { error: junctionError } = await supabase
            .from('monitors_schools')
            .insert([{ monitor_id: newMonitor.id, school_id: schoolId }]);

        if (junctionError) {
            console.error('Error linking monitor to school:', junctionError);
            throw new Error(junctionError.message);
        }

        return newMonitor;
    },

    updateMonitor: async (id: string, updates: Partial<Monitor>): Promise<Monitor> => {
        const { data, error } = await supabase
            .from('monitors')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating monitor:', error);
            throw new Error(error.message);
        }

        return data;
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
    }
};
