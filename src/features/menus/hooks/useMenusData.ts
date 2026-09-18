import { useState, useEffect, useMemo, useCallback } from 'react'
import { MenuService, type DayCoverage, type DailyMenu } from '@/services/menus.service'
import { ChildService } from '@/services/children.service'
import { SchoolService, type School } from '@/services/schools.service'
import { formatDate } from '../utils/date-utils'
import type { MenuGroup, DayCoverageInfo, SpecialMenuChild, SpecialMenuVariant } from '../types'

const DISH_FIELDS: { field: 'first_course' | 'second_course' | 'side' | 'salad' | 'dessert'; label: string }[] = [
    { field: 'first_course', label: 'Primer Plato' },
    { field: 'second_course', label: 'Segundo Plato' },
    { field: 'side', label: 'Guarnición' },
    { field: 'salad', label: 'Ensalada' },
    { field: 'dessert', label: 'Postre' },
]

type SpecialMenuChildRow = Awaited<ReturnType<typeof ChildService.getChildrenAllergensBySchools>>[number]

export const useMenusData = () => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    })
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [schools, setSchools] = useState<School[]>([])
    const [coverage, setCoverage] = useState<DayCoverage[]>([])
    const [dailyAssignments, setDailyAssignments] = useState<DailyMenu[]>([])
    const [specialMenuChildren, setSpecialMenuChildren] = useState<SpecialMenuChildRow[]>([])
    const [totalSchools, setTotalSchools] = useState(0)
    const [isLoadingCoverage, setIsLoadingCoverage] = useState(false)
    const [isLoadingDaily, setIsLoadingDaily] = useState(false)

    // Fetch schools and total schools count
    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const data = await SchoolService.getAllSchools()
                setSchools(data)
                setTotalSchools(data.length)
            } catch (err) {
                console.error('Error fetching schools:', err)
            }
        }
        fetchSchools()
    }, [])

    const fetchCoverage = useCallback(async () => {
        if (!currentMonth) return
        const start = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1))
        const end = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0))

        try {
            setIsLoadingCoverage(true)
            const coverageData = await MenuService.getMenuCoverage(start, end)
            setCoverage(coverageData)
        } catch (err) {
            console.error('Error fetching coverage:', err)
        } finally {
            setIsLoadingCoverage(false)
        }
    }, [currentMonth])

    useEffect(() => {
        fetchCoverage()

        // When month changes, select the first workday of that month
        const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        const firstWorkday = new Date(firstDayOfMonth)
        while (firstWorkday.getDay() === 0 || firstWorkday.getDay() === 6) {
            firstWorkday.setDate(firstWorkday.getDate() + 1)
        }

        const isDifferentMonth = !selectedDate ||
            selectedDate.getMonth() !== currentMonth.getMonth() ||
            selectedDate.getFullYear() !== currentMonth.getFullYear()

        if (isDifferentMonth) {
            setSelectedDate(firstWorkday)
        }
    }, [currentMonth, fetchCoverage, selectedDate])

    const getDayCoverage = useCallback((date: Date): DayCoverageInfo => {
        const dateStr = formatDate(date);
        const dayCoverage = coverage.find(c => c.date === dateStr);
        const count = dayCoverage?.assigned_count || 0;
        const menuIds = dayCoverage?.menu_ids || [];

        return {
            count,
            menuIds,
            total: totalSchools,
            isAll: count === totalSchools && totalSchools > 0,
            isWorkingDay: date.getDay() !== 0 && date.getDay() !== 6
        };
    }, [coverage, totalSchools])

    const fetchDaily = useCallback(async () => {
        if (!selectedDate) return

        const coverageInfo = getDayCoverage(selectedDate)

        if (coverageInfo.menuIds.length === 0) {
            setDailyAssignments([])
            return
        }

        const dateStr = formatDate(selectedDate)
        try {
            setIsLoadingDaily(true)
            const data = await MenuService.getDailyMenus(dateStr, coverageInfo.menuIds)
            setDailyAssignments(data)
        } catch (err) {
            console.error('Error fetching daily menus:', err)
        } finally {
            setIsLoadingDaily(false)
        }
    }, [selectedDate, getDayCoverage])

    useEffect(() => {
        fetchDaily()
    }, [selectedDate, coverage, fetchDaily])

    useEffect(() => {
        let cancelled = false
        const schoolIds = Array.from(new Set(dailyAssignments.flatMap(a => a.school_ids)))
        if (schoolIds.length === 0) {
            setSpecialMenuChildren([])
            return
        }
        ChildService.getChildrenAllergensBySchools(schoolIds)
            .then(data => {
                if (!cancelled) setSpecialMenuChildren(data)
            })
            .catch(err => console.error('Error fetching children allergens:', err))
        return () => { cancelled = true }
    }, [dailyAssignments])

    const groupedMenus = useMemo((): MenuGroup[] => {
        if (!selectedDate || dailyAssignments.length === 0) return [];

        const flat: MenuGroup[] = dailyAssignments.map(assignment => {
            const menuSchools = assignment.school_ids.map(id => {
                return schools.find(s => s.id === id) || { id, name: `School ${id}` };
            });

            // Menu records use a legacy bilingual shape in the shared schema.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = assignment.menu as any;
            return {
                menu: {
                    ...m,
                    first_course: m.first_course || m.primero,
                    second_course: m.second_course || m.segundo,
                    side: m.side || m.guarnicion,
                    salad: m.salad || m.ensalada,
                    dessert: m.dessert || m.postre,
                    startDate: m.startDate || m.start_date,
                    endDate: m.endDate || m.end_date
                },
                schools: menuSchools,
                schoolIds: assignment.school_ids
            };
        });

        const isSpecial = (type: string) => type !== 'normal'
        const schoolKey = (ids: string[]) => [...ids].sort().join('|')

        const bases = flat.filter(g => !isSpecial(g.menu.type))
        const specials = flat.filter(g => isSpecial(g.menu.type))

        const childrenByCombo = new Map<string, SpecialMenuChild[]>()
        specialMenuChildren.forEach(child => {
            const combo = child.allergens.map(a => a.name).sort().join(' + ')
            if (!childrenByCombo.has(combo)) childrenByCombo.set(combo, [])
            childrenByCombo.get(combo)!.push({
                id: child.id,
                first_name: child.first_name,
                last_name: child.last_name,
                className: child.className,
                schoolName: child.schoolName
            })
        })

        const matched = new Set<string>()
        const withVariants: MenuGroup[] = bases.map(base => {
            const baseKey = schoolKey(base.schoolIds)
            const variants: SpecialMenuVariant[] = []
            for (const special of specials) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const m = special.menu as any
                if (matched.has(special.menu.id)) continue
                if (schoolKey(special.schoolIds) !== baseKey) continue
                matched.add(special.menu.id)
                const changed = DISH_FIELDS
                    .filter(f => (m[f.field] || '') !== (base.menu[f.field] || ''))
                    .map(f => ({ field: f.field, label: f.label, value: m[f.field] || '—' }))
                variants.push({
                    id: m.id,
                    type: m.type,
                    schoolIds: special.schoolIds,
                    children: childrenByCombo.get(m.type) || [],
                    changed,
                    first_course: m.first_course || '',
                    second_course: m.second_course || '',
                    side: m.side || '',
                    salad: m.salad || '',
                    dessert: m.dessert || ''
                })
            }
            return variants.length > 0 ? { ...base, variants } : base
        })

        const orphanSpecials = specials.filter(s => !matched.has(s.menu.id))
        return [...withVariants, ...orphanSpecials];
    }, [selectedDate, dailyAssignments, schools, specialMenuChildren]);

    const assignedSchoolIds = useMemo(() => {
        return new Set(groupedMenus.flatMap(g => g.schoolIds));
    }, [groupedMenus]);

    const unassignedSchoolsCount = useMemo(() => {
        return schools.length - assignedSchoolIds.size;
    }, [schools, assignedSchoolIds]);

    return {
        selectedDate,
        setSelectedDate,
        currentMonth,
        setCurrentMonth,
        schools,
        groupedMenus,
        assignedSchoolIds,
        unassignedSchoolsCount,
        isLoadingCoverage,
        isLoadingDaily,
        getDayCoverage,
        refreshData: () => {
            fetchCoverage()
            fetchDaily()
        }
    }
}
