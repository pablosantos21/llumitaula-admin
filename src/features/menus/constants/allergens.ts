export interface Allergen {
    id: string;
    name: string;
    icon: string;
}

export const ALLERGENS: Allergen[] = [
    { id: 'gluten', name: 'Gluten', icon: '🌾' },
    { id: 'crustaceans', name: 'Crustáceos', icon: '🦐' },
    { id: 'eggs', name: 'Huevos', icon: '🥚' },
    { id: 'fish', name: 'Pescado', icon: '🐟' },
    { id: 'peanuts', name: 'Cacahuetes', icon: '🥜' },
    { id: 'soybeans', name: 'Soja', icon: '🌿' },
    { id: 'milk', name: 'Lácteos', icon: '🥛' },
    { id: 'nuts', name: 'Frutos de cáscara', icon: '🌰' },
    { id: 'celery', name: 'Apio', icon: '🥬' },
    { id: 'mustard', name: 'Mostaza', icon: '🌭' },
    { id: 'sesame', name: 'Sésamo', icon: '🥯' },
    { id: 'sulphites', name: 'Sulfitos', icon: '🍷' },
    { id: 'lupin', name: 'Altramuces', icon: '🌾' },
    { id: 'molluscs', name: 'Moluscos', icon: '🐚' },
];
