import type { MenuType } from "@/mocks/menus";
import type { School } from "@/mocks/schools";

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
    changed: { field: string; label: string; value: string }[];
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
