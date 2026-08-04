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
}

export interface DayCoverageInfo {
    count: number;
    menuIds: string[];
    total: number;
    isAll: boolean;
    isWorkingDay: boolean;
}
