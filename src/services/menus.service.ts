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
    getMonthlyPrintAssignments: async (startDate: string, endDate: string): Promise<Record<string, { menu: DailyMenu['menu'] }[]>> => {
        const { data: assignments, error: assignmentsError } = await supabase
            .from('menus_schools')
            .select('date, menu_id')
            .gte('date', startDate)
            .lte('date', endDate);

        if (assignmentsError) throw new Error(assignmentsError.message);
        const rows = assignments || [];
        const menuIds = Array.from(new Set(rows.map(row => row.menu_id).filter(Boolean)));
        if (menuIds.length === 0) return {};

        const { data: menus, error: menusError } = await supabase
            .from('menus')
            .select('*')
            .in('id', menuIds);
        if (menusError) throw new Error(menusError.message);

        const menusById = new Map((menus || []).map((menu: any) => [menu.id, {
            ...menu,
            first_course: menu.first_course || menu.primero,
            second_course: menu.second_course || menu.segundo,
            side: menu.side || menu.guarnicion,
            salad: menu.salad || menu.ensalada,
            dessert: menu.dessert || menu.postre,
        }]));
        return rows.reduce<Record<string, { menu: DailyMenu['menu'] }[]>>((byDate, row) => {
            const menu = menusById.get(row.menu_id);
            if (!menu) return byDate;
            const dailyMenus = (byDate[row.date] ||= []);
            if (!dailyMenus.some(assignment => assignment.menu.id === menu.id)) dailyMenus.push({ menu });
            return byDate;
        }, {});
    },

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

    saveMenuWithSchools: async (
        menuId: string | undefined,
        menu: any,
        schoolIds: string[],
        date: string
    ): Promise<string> => {
        // The DB stores the English field names; the forms still send the
        // bilingual shape, so map the Spanish aliases before saving. The menu
        // and its schools go in a single call so a failed school never leaves a
        // menu without schools.
        const { data, error } = await supabase.rpc('save_menu_with_schools', {
            p_menu_id: menuId || null,
            p_menu: {
                type: menu.type || 'normal',
                first_course: menu.first_course || menu.primero || '',
                second_course: menu.second_course || menu.segundo || '',
                side: menu.side || menu.guarnicion || null,
                salad: menu.salad || menu.ensalada || null,
                dessert: menu.dessert || menu.postre || null
            },
            p_school_ids: schoolIds,
            p_date: date
        });

        if (error) {
            console.error('Error saving menu:', error);
            throw new Error(error.message);
        }

        return data as string;
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

    saveSpecialMenus: async (
        schoolIds: string[],
        date: string,
        specialMenus: Array<{
            type: string;
            first_course?: string | null;
            second_course?: string | null;
            side?: string | null;
            salad?: string | null;
            dessert?: string | null;
            primero?: string | null;
            segundo?: string | null;
            guarnicion?: string | null;
            ensalada?: string | null;
            postre?: string | null;
        }>
    ): Promise<string[]> => {
        const payload = specialMenus.map(m => ({
            type: m.type,
            first_course: m.first_course || m.primero || '',
            second_course: m.second_course || m.segundo || '',
            side: m.side || m.guarnicion || null,
            salad: m.salad || m.ensalada || null,
            dessert: m.dessert || m.postre || null,
        }));

        const { data, error } = await supabase.rpc('save_special_menus', {
            p_school_ids: schoolIds,
            p_date: date,
            p_menus: payload,
        });

        if (error) {
            console.error('Error saving special menus:', error);
            throw new Error(error.message);
        }

        return (data as string[]) || [];
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

        const { data: candidateAssignments, error: candidateError } = await supabase
            .from('menus_schools')
            .select('menu_id')
            .eq('date', date)
            .in('school_id', schoolIds);

        if (candidateError) {
            console.error('Error fetching menu assignments:', candidateError);
            throw new Error(candidateError.message);
        }

        const candidateMenuIds = Array.from(new Set((candidateAssignments || []).map((a: any) => a.menu_id)));
        if (candidateMenuIds.length === 0) return [];

        const { data: allAssignments, error: allAssignError } = await supabase
            .from('menus_schools')
            .select('menu_id, school_id')
            .eq('date', date)
            .in('menu_id', candidateMenuIds);

        if (allAssignError) {
            console.error('Error fetching all menu school assignments:', allAssignError);
            throw new Error(allAssignError.message);
        }

        const { data, error: menusError } = await supabase
            .from('menus')
            .select('*')
            .in('id', candidateMenuIds)
            .neq('type', 'normal');

        if (menusError) {
            console.error('Error fetching special menus:', menusError);
            throw new Error(menusError.message);
        }

        const fullAssignments = (allAssignments || []) as { menu_id: string; school_id: string }[];
        const schoolKey = Array.from(new Set(schoolIds)).sort().join('|');

        return (data || [])
            .filter((m: any) => {
                const assigned = fullAssignments
                    .filter(a => a.menu_id === m.id)
                    .map(a => a.school_id)
                    .sort()
                    .join('|');
                return assigned === schoolKey;
            })
            .map((m: any) => ({
                id: m.id,
                type: m.type,
                first_course: m.first_course || m.primero || '',
                second_course: m.second_course || m.segundo || '',
                side: m.side || m.guarnicion || '',
                salad: m.salad || m.ensalada || '',
                dessert: m.dessert || m.postre || '',
            }));
    },

    deleteSpecialMenus: async (menuId: string): Promise<void> => {
        const { data: assignments, error: fetchError } = await supabase
            .from('menus_schools')
            .select('school_id, date')
            .eq('menu_id', menuId);

        if (fetchError) {
            console.error('Error fetching assignments:', fetchError);
            throw new Error(fetchError.message);
        }

        const rows = (assignments || []) as { school_id: string; date: string }[];
        if (rows.length === 0) return;

        const date = rows[0].date;
        const schoolIds = Array.from(new Set(rows.map(a => a.school_id)));

        await MenuService.saveSpecialMenus(schoolIds, date, []);
    },
};
