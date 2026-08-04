import { supabase } from '../lib/supabase';

export interface Allergen {
    id: string;
    name: string;
}

export const AllergenService = {
    getAll: async (): Promise<Allergen[]> => {
        const { data, error } = await supabase
            .from('allergens')
            .select('id, name')
            .order('name');

        if (error) {
            console.error('Error fetching allergens:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    create: async (name: string): Promise<Allergen> => {
        const { data, error } = await supabase
            .from('allergens')
            .insert([{ name }])
            .select()
            .single();

        if (error) {
            console.error('Error creating allergen:', error);
            throw new Error(error.message);
        }

        return data;
    },

    update: async (id: string, name: string): Promise<Allergen> => {
        const { data, error } = await supabase
            .from('allergens')
            .update({ name })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating allergen:', error);
            throw new Error(error.message);
        }

        return data;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('allergens')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting allergen:', error);
            throw new Error(error.message);
        }
    }
};
