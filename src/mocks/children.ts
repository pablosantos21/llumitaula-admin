export interface Child {
    id: string;
    name: string;
    class: string;
    course: 'Infantil' | 'Primaria' | 'ESO';
    health: string[];
    observations: string;
}

export const MOCK_HEALTH_TAGS = [
    'Alérgia Frutos Secos',
    'Sin Gluten',
    'Sin Lactosa',
    'Vegetariano',
    'Vegano',
    'Sin Huevo',
    'Diabetes',
    'Sin Marisco',
    'Asmático'
];

export const MOCK_CHILDREN: Child[] = [
    {
        id: '1',
        name: 'Paula Sanchis',
        class: '1º Primaria A',
        course: 'Primaria',
        health: ['Alérgia Frutos Secos'],
        observations: 'Trae su propia merienda'
    },
    {
        id: '2',
        name: 'Marc Ferrés',
        class: 'P4 Infantil B',
        course: 'Infantil',
        health: ['Sin Gluten'],
        observations: 'Sensibilidad leve'
    },
    {
        id: '3',
        name: 'Lucía Gómez',
        class: '1º ESO A',
        course: 'ESO',
        health: [],
        observations: 'Dieta normal'
    },
    {
        id: '4',
        name: 'Joan Baptista',
        class: '1º Primaria A',
        course: 'Primaria',
        health: ['Vegetariano'],
        observations: ''
    },
    {
        id: '5',
        name: 'Sofia Ortiz',
        class: 'P5 Infantil A',
        course: 'Infantil',
        health: ['Sin Lactosa', 'Sin Huevo'],
        observations: 'Reacción severa'
    }
];
