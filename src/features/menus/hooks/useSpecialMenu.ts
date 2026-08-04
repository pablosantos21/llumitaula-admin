import { useState, useEffect, useCallback, useMemo } from 'react'
import { MenuService } from '@/services/menus.service'
import { ChildService } from '@/services/children.service'

interface AllergenGroup {
    name: string;
    children: {
        id: string;
        first_name: string;
        last_name: string;
    }[];
    count: number;
}

interface MatrixCell {
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
}

interface MenuData {
    id: string;
    type: string;
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
}

export const useSpecialMenu = (menuId: string) => {
    const [menu, setMenu] = useState<MenuData | null>(null)
    const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
    const [date, setDate] = useState<string>('')
    const [allergenGroups, setAllergenGroups] = useState<AllergenGroup[]>([])
    const [matrixData, setMatrixData] = useState<Record<string, MatrixCell>>({})
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true)
                const menuData = await MenuService.getMenuWithSchools(menuId)
                setMenu(menuData.menu)
                setSchools(menuData.schools)
                setDate(menuData.date)

                const schoolIds = menuData.schools.map(s => s.id)
                if (schoolIds.length === 0) {
                    setAllergenGroups([])
                    setMatrixData({})
                    return
                }

                const children = await ChildService.getChildrenAllergensBySchools(schoolIds)

                const groupMap = new Map<string, { id: string; first_name: string; last_name: string }[]>()
                children.forEach(child => {
                    const allergenNames = child.allergens.map(a => a.name).sort()
                    const key = allergenNames.join(' + ')
                    if (!groupMap.has(key)) groupMap.set(key, [])
                    groupMap.get(key)!.push({
                        id: child.id,
                        first_name: child.first_name,
                        last_name: child.last_name
                    })
                })

                const groups: AllergenGroup[] = Array.from(groupMap.entries()).map(([name, children]) => ({
                    name,
                    children,
                    count: children.length
                }))

                setAllergenGroups(groups)

                const initialMatrix: Record<string, MatrixCell> = {}
                const base = {
                    first_course: menuData.menu.first_course || '',
                    second_course: menuData.menu.second_course || '',
                    side: menuData.menu.side || '',
                    salad: menuData.menu.salad || '',
                    dessert: menuData.menu.dessert || ''
                }
                groups.forEach(group => {
                    initialMatrix[group.name] = { ...base }
                })
                setMatrixData(initialMatrix)
            } catch (err) {
                console.error('Error loading special menu data:', err)
                setError(err instanceof Error ? err.message : 'Error al cargar los datos')
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [menuId])

    const updateMatrixField = useCallback((groupName: string, field: string, value: string) => {
        setMatrixData(prev => ({
            ...prev,
            [groupName]: {
                ...prev[groupName],
                [field]: value
            }
        }))
    }, [])

    const handleSave = useCallback(async () => {
        if (!menu) return
        try {
            setIsSaving(true)

            await MenuService.deleteSpecialMenus(menu.id)

            const schoolIds = schools.map(s => s.id)

            for (const [groupName, fields] of Object.entries(matrixData)) {
                const hasContent = Object.values(fields).some(v => !!v)
                if (!hasContent) continue

                const menuData = {
                    type: groupName,
                    first_course: fields.first_course,
                    second_course: fields.second_course,
                    side: fields.side,
                    salad: fields.salad,
                    dessert: fields.dessert,
                }

                const savedMenu = await MenuService.upsertMenu(menuData)

                await MenuService.assignMenuToSchools(
                    savedMenu.id,
                    schoolIds,
                    date
                )
            }
        } catch (err) {
            console.error('Error saving special menus:', err)
            throw err
        } finally {
            setIsSaving(false)
        }
    }, [menu, schools, date, matrixData])

    const fields = useMemo<{ label: string; field: keyof MatrixCell }[]>(() => [
        { label: 'Primer Plato', field: 'first_course' },
        { label: 'Segundo Plato', field: 'second_course' },
        { label: 'Guarnición', field: 'side' },
        { label: 'Ensalada', field: 'salad' },
        { label: 'Postre', field: 'dessert' },
    ], [])

    return {
        menu,
        schools,
        date,
        allergenGroups,
        matrixData,
        error,
        isLoading,
        isSaving,
        updateMatrixField,
        handleSave,
        fields
    }
}
