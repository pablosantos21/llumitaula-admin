export interface Incident {
    id: string;
    childId: string;
    childName: string;
    date: string;
    type: 'comida' | 'comportamiento' | 'alergia' | 'otro';
    comment: string;
    severity: 'baja' | 'media' | 'alta';
}

export const MOCK_INCIDENTS: Incident[] = [
    {
        id: '1',
        childId: '1',
        childName: 'Paula Sanchis',
        date: '2024-01-20',
        type: 'comida',
        comment: 'No ha querido comer la verdura, dice que le duele la tripa.',
        severity: 'baja'
    },
    {
        id: '2',
        childId: '2',
        childName: 'Marc Ferrés',
        date: '2024-01-21',
        type: 'alergia',
        comment: 'Ligera reacción cutánea tras el postre. Se ha avisado a los padres.',
        severity: 'alta'
    },
    {
        id: '3',
        childId: '3',
        childName: 'Lucía Gómez',
        date: '2024-01-22',
        type: 'comportamiento',
        comment: 'Ha gritado a un compañero durante el patio.',
        severity: 'media'
    }
];
