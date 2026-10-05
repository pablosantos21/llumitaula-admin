/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabase';

export interface Child {
    id: string;
    first_name: string;
    last_name: string;
    class_id: string;
    is_active: boolean;
    created_at: string;
    lunch_weekdays: number[] | null;
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

export type ChildRow = Omit<Child, 'lunch_weekdays'>;

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
        const [childrenResult, lunchDaysResult] = await Promise.all([
            supabase
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
                .order('first_name'),
            supabase
                .from('child_lunch_days')
                .select('child_id, weekdays')
                .eq('school_id', schoolId),
        ]);

        if (childrenResult.error) {
            console.error('Error fetching children:', childrenResult.error);
            throw new Error(childrenResult.error.message);
        }

        if (lunchDaysResult.error) {
            console.error('Error fetching lunch days:', lunchDaysResult.error);
            throw new Error(lunchDaysResult.error.message);
        }

        const weekdaysByChild = new Map<string, number[]>(
            (lunchDaysResult.data || []).map((row: any) => [row.child_id, row.weekdays as number[]])
        );

        return ((childrenResult.data as unknown as Child[]) || []).map(child => ({
            ...child,
            lunch_weekdays: weekdaysByChild.get(child.id) ?? null,
        }));
    },

    createChild: async (child: Omit<Child, 'id' | 'created_at' | 'classes' | 'child_allergens' | 'is_active' | 'lunch_weekdays'>): Promise<ChildRow> => {
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

    updateChild: async (id: string, updates: Partial<ChildRow>): Promise<ChildRow> => {
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

    setChildActive: async (id: string, isActive: boolean): Promise<ChildRow> => {
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

    saveChildLunchDays: async (childId: string, schoolId: string, weekdays: number[] | null): Promise<void> => {
        if (weekdays === null) {
            const { error } = await supabase
                .from('child_lunch_days')
                .delete()
                .eq('child_id', childId)
                .eq('school_id', schoolId);

            if (error) {
                console.error('Error clearing child lunch days:', error);
                throw new Error(error.message);
            }

            return;
        }

        const { error } = await supabase
            .from('child_lunch_days')
            .upsert({
                child_id: childId,
                school_id: schoolId,
                weekdays,
            });

        if (error) {
            console.error('Error saving child lunch days:', error);
            throw new Error(error.message);
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
        className?: string;
        schoolName?: string;
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
                    name,
                    school_id,
                    schools (
                        id,
                        name
                    )
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
            allergens: (c.child_allergens || []).map((ca: any) => ca.allergens),
            className: c.classes?.name,
            schoolName: c.classes?.schools?.name
        }));
    },
};
