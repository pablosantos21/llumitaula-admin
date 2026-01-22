export interface Monitor {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
}

export const MOCK_MONITORS: Monitor[] = [
    {
        id: '1',
        name: 'Ana García',
        code: '1234',
        isActive: true,
    },
    {
        id: '2',
        name: 'Carlos Ruiz',
        code: '5678',
        isActive: true,
    },
    {
        id: '3',
        name: 'Elena Martínez',
        code: '9012',
        isActive: false,
    },
];
