import type { MenuType } from './menus';

export interface School {
    id: string;
    name: string;
    location: string;
    image?: string;
    supportedMenuTypes: MenuType[];
}

export const MOCK_SCHOOLS: School[] = [
    {
        id: '1',
        name: 'CEIP Llum i Taula',
        location: 'Barcelona, Gràcia',
        image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop',
        supportedMenuTypes: ['normal', 'sin-gluten', 'vegetariano', 'halal', 'sin-lactosa', 'sin-plv', 'sin-huevo', 'sin-pescado']
    },
    {
        id: '2',
        name: 'Escola del Mar',
        location: 'Barcelona, Guinardó',
        image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=600&auto=format&fit=crop',
        supportedMenuTypes: ['normal', 'sin-gluten', 'halal', 'sin-lactosa', 'sin-plv', 'sin-huevo']
    },
    {
        id: '3',
        name: 'Institut Escola Arts',
        location: 'Barcelona, Sants',
        image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=600&auto=format&fit=crop',
        supportedMenuTypes: ['normal', 'sin-gluten', 'vegetariano', 'halal', 'sin-lactosa', 'sin-plv', 'sin-huevo', 'sin-pescado']
    }
];
