import { supabase } from '../lib/supabase';

export interface Class {
    id: string;
    name: string;
    school_id: string;
    is_active: boolean;
}

export const ClassService = {
    getClassesBySchool: async (schoolId: string): Promise<Class[]> => {
        const { data, error } = await supabase
            .from('classes')
            .select('id,name,school_id,is_active')
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
            .select('id,name,school_id,is_active')
            .single();

        if (error) {
            console.error('Error creating class:', error);
            throw new Error(error.message);
        }

        return data;
    },

    updateClass: async (id: string, name: string): Promise<Class> => {
        const { data, error } = await supabase
            .from('classes')
            .update({ name })
            .eq('id', id)
            .select('id,name,school_id,is_active')
            .single();

        if (error) {
            console.error('Error updating class:', error);
            throw new Error(error.message);
        }

        return data;
    },

    setClassActive: async (id: string, isActive: boolean): Promise<Class> => {
        const { data, error } = await supabase
            .from('classes')
            .update({ is_active: isActive })
            .eq('id', id)
            .select('id,name,school_id,is_active')
            .single();

        if (error) {
            console.error('Error setting class active state:', error);
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
