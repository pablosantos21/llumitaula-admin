export interface Child {
    id: string;
    name: string;
    class: string;
    course: 'Infantil' | 'Primaria' | 'ESO';
    observations: string;
}

export const MOCK_CHILDREN: Child[] = [
    {
        id: '1',
        name: 'Paula Sanchis',
        class: '1º Primaria A',
        course: 'Primaria',
        observations: 'Alérgica a los frutos secos'
    },
    {
        id: '2',
        name: 'Marc Ferrés',
        class: 'P4 Infantil B',
        course: 'Infantil',
        observations: 'Sin gluten'
    },
    {
        id: '3',
        name: 'Lucía Gómez',
        class: '1º ESO A',
        course: 'ESO',
        observations: 'Dieta normal'
    },
    {
        id: '4',
        name: 'Joan Baptista',
        class: '1º Primaria A',
        course: 'Primaria',
        observations: 'Vegetariano'
    },
    {
        id: '5',
        name: 'Sofia Ortiz',
        class: 'P5 Infantil A',
        course: 'Infantil',
        observations: 'Intolerancia a la lactosa'
    }
];
