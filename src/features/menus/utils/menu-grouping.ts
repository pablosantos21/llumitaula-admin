import type { MenuGroup, SpecialMenuChild, SpecialMenuVariant, MenuDishes, ChangedDish } from '../types';

export type { MenuDishes, ChangedDish };

export const DISH_FIELDS: { field: keyof MenuDishes; label: string }[] = [
    { field: 'first_course', label: 'Primer Plato' },
    { field: 'second_course', label: 'Segundo Plato' },
    { field: 'side', label: 'Guarnición' },
    { field: 'salad', label: 'Ensalada' },
    { field: 'dessert', label: 'Postre' },
];

export function formatSchoolKey(schoolIds: string[]): string {
    return [...schoolIds].sort().join('|');
}

export function formatAllergenKey(allergenNames: string[]): string {
    return [...allergenNames].sort().join(' + ');
}

export function groupChildrenByAllergenKey<T extends { allergens: { name: string }[] }>(
    children: T[]
): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const child of children) {
        const key = formatAllergenKey(child.allergens.map(a => a.name));
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(child);
    }
    return map;
}

export function detectChangedDishes(
    base: Partial<MenuDishes>,
    variant: Partial<MenuDishes>
): ChangedDish[] {
    const changed: ChangedDish[] = [];
    for (const { field, label } of DISH_FIELDS) {
        const baseVal = (base[field] || '').trim();
        const variantVal = (variant[field] || '').trim();
        if (baseVal !== variantVal) {
            changed.push({
                field,
                label,
                value: variantVal || '—',
            });
        }
    }
    return changed;
}

export function pairBaseMenusWithVariants(
    bases: MenuGroup[],
    specials: MenuGroup[],
    childrenByCombo: Map<string, SpecialMenuChild[]>
): MenuGroup[] {
    const matched = new Set<string>();

    const withVariants: MenuGroup[] = bases.map(base => {
        const baseKey = formatSchoolKey(base.schoolIds);
        const variants: SpecialMenuVariant[] = [];

        for (const special of specials) {
            if (matched.has(special.menu.id)) continue;
            if (formatSchoolKey(special.schoolIds) !== baseKey) continue;

            matched.add(special.menu.id);
            const changed = detectChangedDishes(base.menu, special.menu);

            variants.push({
                id: special.menu.id,
                type: special.menu.type,
                schoolIds: special.schoolIds,
                children: childrenByCombo.get(special.menu.type) || [],
                changed,
                first_course: special.menu.first_course || '',
                second_course: special.menu.second_course || '',
                side: special.menu.side || '',
                salad: special.menu.salad || '',
                dessert: special.menu.dessert || '',
            });
        }

        return variants.length > 0 ? { ...base, variants } : base;
    });

    const orphanSpecials = specials.filter(special => !matched.has(special.menu.id));
    return [...withVariants, ...orphanSpecials];
}
