import type { School } from "@/services/schools.service";

export type StandardMenuType =
    | 'normal'
    | 'sin-gluten'
    | 'vegetariano'
    | 'halal'
    | 'sin-lactosa'
    | 'sin-plv'
    | 'sin-huevo'
    | 'sin-pescado';

export type MenuType = StandardMenuType | (string & {});

export interface MenuDishes {
    first_course: string;
    second_course: string;
    side: string | null;
    salad: string | null;
    dessert: string | null;
}

export interface ChangedDish {
    field: keyof MenuDishes;
    label: string;
    value: string;
}

export interface NormalMenuFormData {
    id?: string;
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
    schoolIds: string[];
    allergens: string[];
}

export interface MenuGroup {
    menu: {
        id: string;
        type: MenuType;
        first_course: string;
        second_course: string;
        side: string;
        salad: string;
        dessert: string;
        allergens?: string[];
        startDate?: string;
        endDate?: string;
    };
    schools: Partial<School>[];
    schoolIds: string[];
    variants?: SpecialMenuVariant[];
}

export interface SpecialMenuChild {
    id: string;
    first_name: string;
    last_name: string;
    className?: string;
    schoolName?: string;
}

export interface SpecialMenuVariant {
    id: string;
    type: string;
    schoolIds: string[];
    children: SpecialMenuChild[];
    changed: ChangedDish[];
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
}

export interface DayCoverageInfo {
    count: number;
    menuIds: string[];
    total: number;
    isAll: boolean;
    isWorkingDay: boolean;
}
