import { supabase } from '../lib/supabase';

export interface Class {
    id: string;
    name: string;
    school_id: string;
}

export const ClassService = {
    getClassesBySchool: async (schoolId: string): Promise<Class[]> => {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('school_id', schoolId)
            .order('name');

        if (error) {
            console.error('Error fetching classes:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    createClass: async (name: string, schoolId: string): Promise<Class> => {
        const { data, error } = await supabase
            .from('classes')
            .insert([{ name, school_id: schoolId }])
            .select()
            .single();

        if (error) {
            console.error('Error creating class:', error);
            throw new Error(error.message);
        }

        return data;
    },

    deleteClass: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('classes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting class:', error);
            throw new Error(error.message);
        }
    }
};
