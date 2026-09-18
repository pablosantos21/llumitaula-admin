/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabase';
import type { MenuType } from '../mocks/menus';

export interface MenuAssignment {
    id: string;
    menu_id: string;
    school_id: string;
    date: string;
    menus?: {
        id: string;
        name: string;
        type: MenuType;
        primero: string;
        segundo: string;
        guarnicion: string;
        ensalada: string;
        postre: string;
        start_date: string;
        end_date: string;
    }
}

export interface DayCoverage {
    date: string;
    assigned_count: number;
    menu_ids: string[];
}

export interface DailyMenu {
    menu: {
        id: string;
        name: string;
        type: MenuType;
        [key: string]: any;
    };
    school_ids: string[];
}

export const MenuService = {
    getMenuCoverage: async (startDate: string, endDate: string): Promise<DayCoverage[]> => {
        // This query gets the count of unique schools assigned a menu for each date in the range
        const { data, error } = await supabase
            .from('menus_schools')
            .select('date, school_id, menu_id')
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching menu coverage:', error);
            throw new Error(error.message);
        }

        // Process data to count unique schools and menus per date
        const coverageMap = (data || []).reduce((acc: Record<string, { schools: Set<string>; menus: Set<string> }>, curr) => {
            if (!acc[curr.date]) acc[curr.date] = { schools: new Set(), menus: new Set() };
            acc[curr.date].schools.add(curr.school_id);
            if (curr.menu_id) acc[curr.date].menus.add(curr.menu_id);
            return acc;
        }, {});

        return Object.entries(coverageMap).map(([date, info]) => ({
            date,
            assigned_count: info.schools.size,
            menu_ids: Array.from(info.menus)
        }));
    },

    getDailyMenus: async (date: string, menuIds: string[]): Promise<DailyMenu[]> => {
        if (menuIds.length === 0) return [];

        const { data, error } = await supabase
            .from('menus')
            .select(`
                *,
                menus_schools!inner (
                    *
                )
            `)
            .in('id', menuIds)
            .eq('menus_schools.date', date);

        if (error) {
            console.error('Error fetching daily menus:', error);
            throw new Error(error.message);
        }

        return (data || []).map((m: any) => {
            const { menus_schools, ...menuData } = m;
            return {
                menu: {
                    ...menuData,
                    // Ensure we map the English fields correctly if they came in different formats
                    first_course: menuData.first_course || menuData.primero,
                    second_course: menuData.second_course || menuData.segundo,
                    side: menuData.side || menuData.guarnicion,
                    salad: menuData.salad || menuData.ensalada,
                    dessert: menuData.dessert || menuData.postre
                },
                school_ids: menus_schools.map((ms: any) => ms.school_id)
            };
        });
    },

    upsertMenu: async (menu: any): Promise<any> => {
        const { id, ...menuData } = menu;

        // Ensure we are using the English field names for the DB
        const dbData = {
            ...menuData,
            // If they are passed as Spanish, map them
            first_course: menuData.first_course || menuData.primero,
            second_course: menuData.second_course || menuData.segundo,
            side: menuData.side || menuData.guarnicion,
            salad: menuData.salad || menuData.ensalada,
            dessert: menuData.dessert || menuData.postre,
        };

        // Remove Spanish keys if they exist to avoid DB errors
        delete (dbData as any).primero;
        delete (dbData as any).segundo;
        delete (dbData as any).guarnicion;
        delete (dbData as any).ensalada;
        delete (dbData as any).postre;

        const { data, error } = await supabase
            .from('menus')
            .upsert(id ? { id, ...dbData } : dbData)
            .select()
            .single();

        if (error) {
            console.error('Error upserting menu:', error);
            throw new Error(error.message);
        }

        return data;
    },

    assignMenuToSchools: async (menuId: string, schoolIds: string[], date: string): Promise<void> => {
        // First, we might want to remove existing assignments for these schools on this date
        // But only for the same menu type? This is tricky without knowing the type.
        // For now, let's just delete assignments for this specific menu and date to refresh them
        const { error: deleteError } = await supabase
            .from('menus_schools')
            .delete()
            .eq('menu_id', menuId)
            .eq('date', date);

        if (deleteError) {
            console.error('Error deleting old assignments:', deleteError);
            throw new Error(deleteError.message);
        }

        if (schoolIds.length === 0) return;

        const assignments = schoolIds.map(school_id => ({
            menu_id: menuId,
            school_id,
            date
        }));

        const { error: insertError } = await supabase
            .from('menus_schools')
            .insert(assignments);

        if (insertError) {
            console.error('Error inserting assignments:', insertError);
            throw new Error(insertError.message);
        }
    },

    getMenuWithSchools: async (menuId: string): Promise<{
        menu: any;
        schools: { id: string; name: string }[];
        date: string;
    }> => {
        const { data, error } = await supabase
            .from('menus')
            .select(`
                *,
                menus_schools (
                    school_id,
                    date,
                    schools (
                        id,
                        name
                    )
                )
            `)
            .eq('id', menuId)
            .single();

        if (error) {
            console.error('Error fetching menu:', error);
            throw new Error(error.message);
        }

        const { menus_schools, ...menuData } = data;
        const schools = menus_schools.map((ms: any) => ms.schools);
        const date = menus_schools[0]?.date || '';

        return {
            menu: {
                ...menuData,
                first_course: menuData.first_course || menuData.primero,
                second_course: menuData.second_course || menuData.segundo,
                side: menuData.side || menuData.guarnicion,
                salad: menuData.salad || menuData.ensalada,
                dessert: menuData.dessert || menuData.postre,
            },
            schools,
            date
        };
    },

    getSpecialMenusForDate: async (date: string, schoolIds: string[]): Promise<{
        id: string;
        type: string;
        first_course: string;
        second_course: string;
        side: string;
        salad: string;
        dessert: string;
    }[]> => {
        if (schoolIds.length === 0) return [];

        const { data: assignments, error } = await supabase
            .from('menus_schools')
            .select('menu_id, school_id')
            .eq('date', date)
            .in('school_id', schoolIds);

        if (error) {
            console.error('Error fetching menu assignments:', error);
            throw new Error(error.message);
        }

        const menuIds = Array.from(new Set((assignments || []).map((a: any) => a.menu_id)));
        if (menuIds.length === 0) return [];

        const { data, error: menusError } = await supabase
            .from('menus')
            .select('*')
            .in('id', menuIds)
            .neq('type', 'normal');

        if (menusError) {
            console.error('Error fetching special menus:', menusError);
            throw new Error(menusError.message);
        }

        const schoolKey = [...schoolIds].sort().join('|');

        return (data || [])
            .filter((m: any) => {
                const assigned = (assignments || [])
                    .filter((a: any) => a.menu_id === m.id)
                    .map((a: any) => a.school_id)
                    .sort()
                    .join('|');
                return assigned === schoolKey;
            })
            .map((m: any) => ({
                id: m.id,
                type: m.type,
                first_course: m.first_course || m.primero,
                second_course: m.second_course || m.segundo,
                side: m.side || m.guarnicion,
                salad: m.salad || m.ensalada,
                dessert: m.dessert || m.postre,
            }));
    },

    deleteSpecialMenus: async (menuId: string): Promise<void> => {
        const { data: assignments, error: fetchError } = await supabase
            .from('menus_schools')
            .select('menu_id, date')
            .eq('menu_id', menuId);

        if (fetchError) {
            console.error('Error fetching assignments:', fetchError);
            throw new Error(fetchError.message);
        }

        if (!assignments || assignments.length === 0) return;

        const date = assignments[0].date;

        const { data: sameDay, error: sameDayError } = await supabase
            .from('menus_schools')
            .select('menu_id')
            .eq('date', date);

        if (sameDayError) {
            console.error('Error fetching same-day menus:', sameDayError);
            throw new Error(sameDayError.message);
        }

        const menuIds = sameDay.map((ms: any) => ms.menu_id);

        const { data: specialMenus, error: specialError } = await supabase
            .from('menus')
            .select('id')
            .in('id', menuIds)
            .neq('type', 'normal');

        if (specialError) {
            console.error('Error fetching special menus:', specialError);
            throw new Error(specialError.message);
        }

        const specialIds = specialMenus.map((m: any) => m.id);

        if (specialIds.length > 0) {
            const { error: delAssignError } = await supabase
                .from('menus_schools')
                .delete()
                .in('menu_id', specialIds);

            if (delAssignError) {
                console.error('Error deleting special menu assignments:', delAssignError);
                throw new Error(delAssignError.message);
            }

            const { error: delMenuError } = await supabase
                .from('menus')
                .delete()
                .in('id', specialIds);

            if (delMenuError) {
                console.error('Error deleting special menus:', delMenuError);
                throw new Error(delMenuError.message);
            }
        }
    },
};
