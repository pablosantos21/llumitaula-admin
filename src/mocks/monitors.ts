export interface Monitor {
    id: string;
    name: string;
    email: string;
    assignedClass: string;
    isActive: boolean;
}

export const MOCK_MONITORS: Monitor[] = [
    {
        id: '1',
        name: 'Ana García',
        email: 'ana.garcia@colegio.com',
        assignedClass: '1º Primaria A',
        isActive: true,
    },
    {
        id: '2',
        name: 'Carlos Ruiz',
        email: 'carlos.ruiz@colegio.com',
        assignedClass: '2º Primaria B',
        isActive: true,
    },
    {
        id: '3',
        name: 'Elena Martínez',
        email: 'elena.mtz@colegio.com',
        assignedClass: '3º Primaria A',
        isActive: false,
    },
];
