import { supabase } from '../lib/supabase';

export interface Child {
    id: string;
    first_name: string;
    last_name: string;
    class_id: string;
    created_at: string;
    classes?: {
        id: string;
        name: string;
    }
}

export const ChildService = {
    getChildrenBySchool: async (schoolId: string): Promise<Child[]> => {
        const { data, error } = await supabase
            .from('children')
            .select(`
                id,
                first_name,
                last_name,
                class_id,
                created_at,
                classes!inner(
                    id,
                    name,
                    school_id
                )
            `)
            .eq('classes.school_id', schoolId)
            .order('first_name');

        if (error) {
            console.error('Error fetching children:', error);
            throw new Error(error.message);
        }

        return (data as unknown as Child[]) || [];
    },

    createChild: async (child: Omit<Child, 'id' | 'created_at' | 'classes'>): Promise<Child> => {
        const { data, error } = await supabase
            .from('children')
            .insert([child])
            .select()
            .single();

        if (error) {
            console.error('Error creating child:', error);
            throw new Error(error.message);
        }

        return data;
    },

    updateChild: async (id: string, updates: Partial<Child>): Promise<Child> => {
        const { data, error } = await supabase
            .from('children')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating child:', error);
            throw new Error(error.message);
        }

        return data;
    },

    deleteChild: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('children')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting child:', error);
            throw new Error(error.message);
        }
    }
};
