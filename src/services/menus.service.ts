import { supabase } from '../lib/supabase';
import type { MenuType, MenuDishes } from '../features/menus/types';

export type { MenuDishes };

export interface RawMenuDishes {
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
}

export function normalizeMenuDishes(raw: RawMenuDishes): MenuDishes {
    return {
        first_course: raw.first_course || raw.primero || '',
        second_course: raw.second_course || raw.segundo || '',
        side: raw.side || raw.guarnicion || null,
        salad: raw.salad || raw.ensalada || null,
        dessert: raw.dessert || raw.postre || null,
    };
}

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
    };
}

export interface DayCoverage {
    date: string;
    assigned_count: number;
    menu_ids: string[];
}

export interface DailyMenuRecord extends MenuDishes {
    id: string;
    type: MenuType;
    name?: string;
    startDate?: string;
    endDate?: string;
    allergens?: string[];
}

export interface DailyMenu {
    menu: DailyMenuRecord;
    school_ids: string[];
}

export interface MenuWithSchoolsResult {
    menu: DailyMenuRecord & { side: string; salad: string; dessert: string };
    schools: { id: string; name: string }[];
    date: string;
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

        interface DbMenuRow extends RawMenuDishes {
            id: string;
            type?: MenuType;
            name?: string;
            startDate?: string;
            endDate?: string;
            start_date?: string;
            end_date?: string;
            allergens?: string[];
        }

        const menuRows = (menus || []) as DbMenuRow[];
        const menusById = new Map<string, DailyMenuRecord>(menuRows.map(menu => {
            const normalized = normalizeMenuDishes(menu);
            return [menu.id, {
                id: menu.id,
                type: menu.type || 'normal',
                name: menu.name,
                startDate: menu.startDate || menu.start_date,
                endDate: menu.endDate || menu.end_date,
                allergens: menu.allergens,
                ...normalized,
            }];
        }));

        return rows.reduce<Record<string, { menu: DailyMenu['menu'] }[]>>((byDate, row) => {
            const menu = menusById.get(row.menu_id);
            if (!menu) return byDate;
            const dailyMenus = (byDate[row.date] ||= []);
            if (!dailyMenus.some(assignment => assignment.menu.id === menu.id)) dailyMenus.push({ menu });
            return byDate;
        }, {});
    },

    getMenuCoverage: async (startDate: string, endDate: string): Promise<DayCoverage[]> => {
        const { data, error } = await supabase
            .from('menus_schools')
            .select('date, school_id, menu_id')
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching menu coverage:', error);
            throw new Error(error.message);
        }

        interface CoverageRow {
            date: string;
            school_id: string;
            menu_id: string | null;
        }

        const rows = (data || []) as CoverageRow[];
        const coverageMap = rows.reduce<Record<string, { schools: Set<string>; menus: Set<string> }>>((acc, curr) => {
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

        interface DbDailyMenuRow extends RawMenuDishes {
            id: string;
            type?: MenuType;
            name?: string;
            startDate?: string;
            endDate?: string;
            start_date?: string;
            end_date?: string;
            allergens?: string[];
            menus_schools: Array<{
                school_id: string;
                date: string;
                menu_id: string;
            }>;
        }

        const rows = (data || []) as unknown as DbDailyMenuRow[];
        return rows.map(m => {
            const { menus_schools = [], ...menuData } = m;
            const normalized = normalizeMenuDishes(menuData);
            return {
                menu: {
                    id: menuData.id,
                    type: menuData.type || 'normal',
                    name: menuData.name,
                    startDate: menuData.startDate || menuData.start_date,
                    endDate: menuData.endDate || menuData.end_date,
                    allergens: menuData.allergens,
                    ...normalized,
                },
                school_ids: menus_schools.map(ms => ms.school_id)
            };
        });
    },

    saveMenuWithSchools: async (
        menuId: string | undefined,
        menu: RawMenuDishes & { type?: MenuType },
        schoolIds: string[],
        date: string
    ): Promise<string> => {
        const normalized = normalizeMenuDishes(menu);
        const { data, error } = await supabase.rpc('save_menu_with_schools', {
            p_menu_id: menuId || null,
            p_menu: {
                type: menu.type || 'normal',
                first_course: normalized.first_course,
                second_course: normalized.second_course,
                side: normalized.side,
                salad: normalized.salad,
                dessert: normalized.dessert,
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

    getMenuWithSchools: async (menuId: string): Promise<MenuWithSchoolsResult> => {
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

        interface DbMenuWithSchoolsRow extends RawMenuDishes {
            id: string;
            type?: MenuType;
            name?: string;
            startDate?: string;
            endDate?: string;
            start_date?: string;
            end_date?: string;
            allergens?: string[];
            menus_schools: Array<{
                school_id: string;
                date: string;
                schools: { id: string; name: string } | null;
            }>;
        }

        const row = data as unknown as DbMenuWithSchoolsRow;
        const { menus_schools = [], ...menuData } = row;
        const schools = menus_schools
            .map(ms => ms.schools)
            .filter((s): s is { id: string; name: string } => s !== null && s !== undefined);
        const date = menus_schools[0]?.date || '';
        const normalized = normalizeMenuDishes(menuData);

        return {
            menu: {
                id: menuData.id,
                type: menuData.type || 'normal',
                name: menuData.name,
                startDate: menuData.startDate || menuData.start_date,
                endDate: menuData.endDate || menuData.end_date,
                allergens: menuData.allergens,
                first_course: normalized.first_course,
                second_course: normalized.second_course,
                side: normalized.side || '',
                salad: normalized.salad || '',
                dessert: normalized.dessert || '',
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
        const payload = specialMenus.map(m => {
            const normalized = normalizeMenuDishes(m);
            return {
                type: m.type,
                first_course: normalized.first_course,
                second_course: normalized.second_course,
                side: normalized.side,
                salad: normalized.salad,
                dessert: normalized.dessert,
            };
        });

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

        interface AssignmentRow {
            menu_id: string;
        }

        const candidateRows = (candidateAssignments || []) as AssignmentRow[];
        const candidateMenuIds = Array.from(new Set(candidateRows.map(a => a.menu_id)));
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

        interface DbSpecialMenuRow extends RawMenuDishes {
            id: string;
            type: string;
        }

        const specialRows = (data || []) as DbSpecialMenuRow[];
        const fullAssignments = (allAssignments || []) as { menu_id: string; school_id: string }[];
        const schoolKey = Array.from(new Set(schoolIds)).sort().join('|');

        return specialRows
            .filter(m => {
                const assigned = fullAssignments
                    .filter(a => a.menu_id === m.id)
                    .map(a => a.school_id)
                    .sort()
                    .join('|');
                return assigned === schoolKey;
            })
            .map(m => {
                const normalized = normalizeMenuDishes(m);
                return {
                    id: m.id,
                    type: m.type,
                    first_course: normalized.first_course,
                    second_course: normalized.second_course,
                    side: normalized.side || '',
                    salad: normalized.salad || '',
                    dessert: normalized.dessert || '',
                };
            });
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
