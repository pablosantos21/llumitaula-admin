import { supabase } from '../lib/supabase';

export interface School {
    id: string;
    name: string;
}

export const SchoolService = {
    getAllSchools: async (): Promise<School[]> => {
        const { data, error } = await supabase
            .from('schools')
            .select('id, name')

        if (error) {
            throw new Error(error.message);
        }

        return data || [];
    },
    createSchool: async (name: string): Promise<School> => {
        const { data, error } = await supabase
            .from('schools')
            .insert([{ name }])
            .select()
            .single()

        if (error) {
            throw new Error(error.message);
        }

        return data;
    },
    updateSchoolName: async (id: string, name: string): Promise<School> => {
        const { data, error } = await supabase
            .from('schools')
            .update({ name })
            .eq('id', id)
            .select('id, name')
            .single()

        if (error) {
            throw error;
        }

        return data;
    },
    deleteSchool: async (id: string): Promise<void> => {
        const { data, error } = await supabase
            .from('schools')
            .delete()
            .eq('id', id)
            .select('id')

        if (error) {
            throw new Error(error.message);
        }

        if (!data || data.length === 0) {
            throw new Error('No se pudo eliminar el colegio o no tienes permiso.');
        }
    },
    getSchoolById: async (id: string): Promise<School> => {
        const { data, error } = await supabase
            .from('schools')
            .select('id, name')
            .eq('id', id)
            .single()

        if (error) {
            throw new Error(error.message);
        }

        return data;
    }
};
