export type MenuType = 'normal' | 'sin-gluten' | 'vegetariano' | 'halal' | 'sin-lactosa' | 'sin-plv' | 'sin-huevo' | 'sin-pescado';

export interface Menu {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    type: MenuType;
    isActive: boolean;
    primero?: string;
    segundo?: string;
    guarnicion?: string;
    ensalada?: string;
    postre?: string;
}

export const MOCK_MENUS: Menu[] = [
    {
        id: '1',
        name: 'Menú General Lentejas',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        type: 'normal',
        isActive: true,
        primero: 'Lentejas con verduras',
        segundo: 'Merluza a la romana',
        guarnicion: 'Arroz blanco',
        ensalada: 'Ensalada mixta',
        postre: 'Fruta de temporada'
    },
    {
        id: '2',
        name: 'Menú General Pollo',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        type: 'normal',
        isActive: true,
        primero: 'Canelones Rossini',
        segundo: 'Pollo al horno',
        guarnicion: 'Patatas asadas',
        ensalada: 'Lechuga y cebolla',
        postre: 'Yogur natural'
    },
    {
        id: '4',
        name: 'Menú Especial Sin Gluten',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        type: 'sin-gluten',
        isActive: true,
        primero: 'Lentejas (sin gluten)',
        segundo: 'Merluza plancha',
        guarnicion: 'Patatas vapor',
        ensalada: 'Tomate aliñado',
        postre: 'Fruta'
    }
];
