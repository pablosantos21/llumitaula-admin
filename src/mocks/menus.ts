export interface Menu {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    type: 'normal' | 'sin-gluten' | 'vegetariano' | 'halal';
    isActive: boolean;
}

export const MOCK_MENUS: Menu[] = [
    {
        id: '1',
        name: 'Menú Enero - General',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        type: 'normal',
        isActive: true,
    },
    {
        id: '2',
        name: 'Menú Enero - Sin Gluten',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        type: 'sin-gluten',
        isActive: true,
    },
    {
        id: '3',
        name: 'Menú Febrero - Vegetariano',
        startDate: '2024-02-01',
        endDate: '2024-02-29',
        type: 'vegetariano',
        isActive: false,
    },
];
