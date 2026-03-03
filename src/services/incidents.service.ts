import { supabase } from '../lib/supabase';

export interface Incident {
    id: string;
    description: string;
    created_at: string;
    child_id: string;
    children?: {
        first_name: string;
        last_name: string;
    }
}

export const IncidentService = {
    getIncidentsBySchool: async (schoolId: string): Promise<Incident[]> => {
        const { data, error } = await supabase
            .from('incidents')
            .select(`
                id,
                description,
                created_at,
                child_id,
                children!inner(
                    first_name,
                    last_name,
                    classes!inner(school_id)
                )
            `)
            .eq('children.classes.school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching incidents:', error);
            throw new Error(error.message);
        }

        return (data as unknown as Incident[]) || [];
    },

    createIncident: async (incident: Omit<Incident, 'id' | 'created_at' | 'children'>): Promise<Incident> => {
        const { data, error } = await supabase
            .from('incidents')
            .insert([incident])
            .select()
            .single();

        if (error) {
            console.error('Error creating incident:', error);
            throw new Error(error.message);
        }

        return data;
    },

    deleteIncident: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('incidents')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting incident:', error);
            throw new Error(error.message);
        }
    }
};
