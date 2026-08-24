/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabase';

export interface Child {
    id: string;
    first_name: string;
    last_name: string;
    class_id: string;
    is_active: boolean;
    created_at: string;
    classes?: {
        id: string;
        name: string;
    }
    child_allergens?: {
        allergen_id: string;
        allergens: {
            id: string;
            name: string;
        }
    }[]
}

export interface ChildWithSchool {
    id: string;
    first_name: string;
    last_name: string;
    class_id: string;
    created_at: string;
    child_allergens?: {
        allergen_id: string;
        allergens: {
            id: string;
            name: string;
        }
    }[]
    classes: {
        id: string;
        name: string;
        school_id: string;
        schools: {
            id: string;
            name: string;
        } | null;
    } | null;
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
                is_active,
                created_at,
                classes!inner(
                    id,
                    name,
                    school_id
                ),
                child_allergens(
                    allergen_id,
                    allergens(
                        id,
                        name
                    )
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

    createChild: async (child: Omit<Child, 'id' | 'created_at' | 'classes' | 'child_allergens' | 'is_active'>): Promise<Child> => {
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

    setChildActive: async (id: string, isActive: boolean): Promise<Child> => {
        const { data, error } = await supabase
            .from('children')
            .update({ is_active: isActive })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error setting child active state:', error);
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
    },

    setChildAllergens: async (childId: string, allergenIds: string[]): Promise<void> => {
        const { error: deleteError } = await supabase
            .from('child_allergens')
            .delete()
            .eq('child_id', childId);

        if (deleteError) {
            console.error('Error deleting child allergens:', deleteError);
            throw new Error(deleteError.message);
        }

        if (allergenIds.length > 0) {
            const rows = allergenIds.map(allergenId => ({
                child_id: childId,
                allergen_id: allergenId,
            }));

            const { error: insertError } = await supabase
                .from('child_allergens')
                .insert(rows);

            if (insertError) {
                console.error('Error inserting child allergens:', insertError);
                throw new Error(insertError.message);
            }
        }
    },

    getAllChildren: async (): Promise<ChildWithSchool[]> => {
        const { data, error } = await supabase
            .from('children')
            .select(`
                id,
                first_name,
                last_name,
                class_id,
                created_at,
                child_allergens(
                    allergen_id,
                    allergens(
                        id,
                        name
                    )
                ),
                classes!inner(
                    id,
                    name,
                    school_id,
                    schools(
                        id,
                        name
                    )
                )
            `)
            .order('first_name');

        if (error) {
            console.error('Error fetching all children:', error);
            throw new Error(error.message);
        }

        return (data as unknown as ChildWithSchool[]) || [];
    },

    getChildrenWithSpecialMenu: async (): Promise<ChildWithSchool[]> => {
        const { data, error } = await supabase
            .from('children')
            .select(`
                id,
                first_name,
                last_name,
                class_id,
                created_at,
                child_allergens(
                    allergen_id,
                    allergens(
                        id,
                        name
                    )
                ),
                classes!inner(
                    id,
                    name,
                    school_id,
                    schools(
                        id,
                        name
                    )
                )
            `)
            .not('child_allergens', 'is', null)
            .order('first_name');

        if (error) {
            console.error('Error fetching children with special menu:', error);
            throw new Error(error.message);
        }

        return (data as unknown as ChildWithSchool[]) || [];
    },

    getChildrenAllergensBySchools: async (schoolIds: string[]): Promise<{
        id: string;
        first_name: string;
        last_name: string;
        allergens: { id: string; name: string }[];
    }[]> => {
        const { data, error } = await supabase
            .from('children')
            .select(`
                id,
                first_name,
                last_name,
                class_id,
                classes!inner(
                    id,
                    school_id
                ),
                child_allergens(
                    allergen_id,
                    allergens(
                        id,
                        name
                    )
                )
            `)
            .in('classes.school_id', schoolIds)
            .not('child_allergens', 'is', null)
            .order('first_name');

        if (error) {
            console.error('Error fetching children allergens:', error);
            throw new Error(error.message);
        }

        return (data || []).map((c: any) => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            allergens: (c.child_allergens || []).map((ca: any) => ca.allergens)
        }));
    },
};
