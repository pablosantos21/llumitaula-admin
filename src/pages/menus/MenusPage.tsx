import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import type { MenuType } from '../../mocks/menus'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Edit2, Check, Utensils, Info, Building2, Plus, Save, ChevronLeft, Loader2 } from 'lucide-react'
import { Calendar } from '../../components/ui/calendar'
import { Modal } from '../../components/ui/modal'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { cn } from '../../lib/utils'
import { MenuService, type DayCoverage, type DailyMenu } from '../../services/menus.service'
import { SchoolService, type School } from '../../services/schools.service'

// Allergens definition
const ALLERGENS = [
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




const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function MenusPage() {
    const navigate = useNavigate()
    const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    })
    const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
    const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<any>(null)
    const [currentMonth, setCurrentMonth] = useState(new Date())

    // New states for real data
    const [schools, setSchools] = useState<School[]>([])
    const [coverage, setCoverage] = useState<DayCoverage[]>([])
    const [dailyAssignments, setDailyAssignments] = useState<DailyMenu[]>([])
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

    const fetchCoverage = async () => {
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
    }

    // Fetch coverage whenever currentMonth changes
    useEffect(() => {
        fetchCoverage()
    }, [currentMonth])

    const fetchDaily = async () => {
        if (!selectedDate) return

        const coverageInfo = getDayCoverage(selectedDate)

        // Optimization: if no menus assigned in coverage data, clear and skip fetch
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
    }

    // Fetch daily menus when date changes
    useEffect(() => {
        fetchDaily()
    }, [selectedDate, coverage]) // Added coverage to dependency to ensure it runs when coverage is loaded

    // Form state for Normal Menu
    const [formData, setFormData] = useState({
        id: '',
        first_course: '',
        second_course: '',
        side: '',
        salad: '',
        dessert: '',
        schoolIds: [] as string[],
        allergens: [] as string[]
    })

    // Form state for Matrix (Special Menus)
    const [matrixData, setMatrixData] = useState<Record<string, any>>({})

    const openNormalMenuModal = (group?: any) => {
        if (group) {
            setEditingGroup(group)
            setFormData({
                id: group.menu?.id || '',
                first_course: group.menu?.first_course || '',
                second_course: group.menu?.second_course || '',
                side: group.menu?.side || '',
                salad: group.menu?.salad || '',
                dessert: group.menu?.dessert || '',
                schoolIds: group.schoolIds || [],
                allergens: group.menu?.allergens || []
            })
        } else {
            setEditingGroup(null)
            setFormData({
                id: '',
                first_course: '',
                second_course: '',
                side: '',
                salad: '',
                dessert: '',
                schoolIds: [],
                allergens: []
            })
        }
        setIsMenuModalOpen(true)
    }

    const openMatrixModal = (group: any) => {
        setEditingGroup(group)
        // Initialize matrix with existing variations or defaults from normal menu
        const initialMatrix: Record<string, any> = {}

        // Find all special types supported by any school in this group
        const supportedSpecialTypes = Array.from(new Set(group.schools.flatMap((s: any) => s.supportedMenuTypes)))
            .filter(t => t !== 'normal') as MenuType[]

        supportedSpecialTypes.forEach(type => {
            const variant = group.variations?.find((v: any) => v.type === type)?.menu
            initialMatrix[type] = {
                first_course: variant?.first_course || group.menu?.first_course || '',
                second_course: variant?.second_course || group.menu?.second_course || '',
                side: variant?.side || group.menu?.side || '',
                salad: variant?.salad || group.menu?.salad || '',
                dessert: variant?.dessert || group.menu?.dessert || ''
            }
        })
        setMatrixData(initialMatrix)
        setIsMatrixModalOpen(true)
    }

    const updateMatrixField = (type: string, field: string, value: string) => {
        setMatrixData(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: value
            }
        }))
    }

    const toggleSelection = (id: string, field: 'schoolIds' | 'allergens') => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].includes(id)
                ? prev[field].filter(item => item !== id)
                : [...prev[field], id]
        }))
    }

    const handleSaveAssignment = async () => {
        if (!selectedDate) return;

        try {
            setIsLoadingDaily(true);

            // 1. Upsert the menu record
            const menuData = {
                id: formData.id || undefined,
                type: 'normal' as MenuType,
                first_course: formData.first_course,
                second_course: formData.second_course,
                side: formData.side,
                salad: formData.salad,
                dessert: formData.dessert,
                // allergens: formData.allergens,
            };

            const savedMenu = await MenuService.upsertMenu(menuData);

            // 2. Assign to schools
            await MenuService.assignMenuToSchools(
                savedMenu.id,
                formData.schoolIds,
                formatDate(selectedDate)
            );

            // 3. Refresh UI
            await fetchCoverage();
            setIsMenuModalOpen(false);
        } catch (err) {
            console.error('Error saving assignment:', err);
            alert('Error al guardar el menú');
        } finally {
            setIsLoadingDaily(false);
        }
    }

    const handleSaveMatrix = async () => {
        if (!selectedDate || !editingGroup) return;

        try {
            setIsLoadingDaily(true);

            const dateStr = formatDate(selectedDate);

            // For each special menu type that has content, upsert and assign
            const savePromises = Object.entries(matrixData).map(async ([type, fields]) => {
                // Only save if there's at least one field filled (or we might want to allow clearing?)
                const hasContent = Object.values(fields).some(v => !!v);
                if (!hasContent) return;

                // 1. Upsert special menu
                const menuData = {
                    type: type as MenuType,
                    ...fields,
                };

                const savedMenu = await MenuService.upsertMenu(menuData);

                // 2. Assign to the schools in the current group
                await MenuService.assignMenuToSchools(
                    savedMenu.id,
                    editingGroup.schoolIds,
                    dateStr
                );
            });

            await Promise.all(savePromises);

            // 3. Refresh UI
            await fetchCoverage();
            setIsMatrixModalOpen(false);
        } catch (err) {
            console.error('Error saving matrix:', err);
            alert('Error al guardar los menús especiales');
        } finally {
            setIsLoadingDaily(false);
        }
    }

    const getTypeBadgeVariant = (type: MenuType) => {
        switch (type) {
            case 'normal': return 'info'
            case 'sin-gluten': return 'warning'
            case 'vegetariano': return 'success'
            case 'halal': return 'default'
            case 'sin-lactosa': return 'warning'
            case 'sin-plv': return 'warning'
            case 'sin-huevo': return 'warning'
            case 'sin-pescado': return 'warning'
            default: return 'default'
        }
    }



    // Calculate school coverage for the calendar
    const getDayCoverage = (date: Date) => {
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
    };

    const renderCalendarDay = (date: Date) => {
        const coverageInfo = getDayCoverage(date);
        if (!coverageInfo.isWorkingDay) return null;

        return (
            <div className="mt-1 flex flex-col items-center">
                {coverageInfo.isAll ? (
                    <div className="bg-emerald-100 rounded-full p-0.5">
                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                    </div>
                ) : coverageInfo.count > 0 ? (
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1 rounded border border-orange-100">
                            Parcial
                        </span>
                        <span className="text-[8px] text-orange-400 mt-0.5">
                            {coverageInfo.count}/{coverageInfo.total}
                        </span>
                    </div>
                ) : (
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full" title="Sin menús" />
                )}
            </div>
        );
    };

    const groupedMenus = useMemo(() => {
        if (!selectedDate || dailyAssignments.length === 0) return [];

        return dailyAssignments.map(assignment => {
            const menuSchools = assignment.school_ids.map(id => {
                return schools.find(s => s.id === id) || { id, name: `School ${id}` };
            });

            const m = assignment.menu as any;
            return {
                menu: {
                    ...m,
                    // English field mapping with fallback
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
    }, [selectedDate, dailyAssignments, schools]);

    const assignedSchoolIds = useMemo(() => {
        return new Set(groupedMenus.flatMap(g => g.schoolIds));
    }, [groupedMenus]);

    const unassignedSchoolsCount = useMemo(() => {
        return schools.length - assignedSchoolIds.size;
    }, [schools, assignedSchoolIds]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/select-school')} className="text-gray-500">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Colegios
                    </Button>
                    <div className="h-6 w-px bg-gray-200" />
                    <div className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-indigo-600" />
                        <h1 className="text-lg font-bold text-gray-900">Gestión de Menús</h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Gestión de Menús</h1>
                        <p className="text-sm text-gray-500">Consulta la cobertura de menús por día y colegio.</p>
                    </div>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Left Column (50%): Status Calendar */}
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Estado de Cobertura</h2>
                                {isLoadingCoverage && <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />}
                            </div>
                            <div className="flex gap-4 text-[10px] items-center">
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 bg-emerald-500 rounded-full" />
                                    <span>Completo</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 bg-amber-500 rounded-full" />
                                    <span>Parcial</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 bg-red-500 rounded-full" />
                                    <span>Sin Menú</span>
                                </div>
                            </div>
                        </div>
                        <Calendar
                            onDateClick={setSelectedDate}
                            renderDay={renderCalendarDay}
                            currentMonth={currentMonth}
                            onMonthChange={setCurrentMonth}
                        />
                    </div>

                    {/* Right Column (50%): Grouped Menu Viewer */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-2 rounded-lg">
                                    <Utensils className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Programación del día</h2>
                                    <p className="text-sm text-gray-500">
                                        {selectedDate
                                            ? selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                            : "Selecciona un día"
                                        }
                                    </p>
                                </div>
                            </div>
                            {isLoadingDaily && <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />}
                        </div>

                        {selectedDate ? (
                            <div className="space-y-4">
                                {isLoadingDaily ? (
                                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                                        <Loader2 className="h-10 w-10 text-indigo-200 animate-spin mb-4" />
                                        <p className="text-gray-400 font-medium">Cargando menús...</p>
                                    </div>
                                ) : (
                                    <>
                                        {groupedMenus.length > 0 ? (
                                            groupedMenus.map((group, idx) => (
                                                <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Building2 className="h-4 w-4 text-indigo-500 shrink-0" />
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {group?.schools.map(s => (
                                                                    <span key={s.id} className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold text-gray-900 shadow-sm text-xs uppercase tracking-tight">
                                                                        {s.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-gray-400"
                                                                onClick={() => openNormalMenuModal(group)}
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="p-6 space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 py-4 border-b border-gray-100 italic text-sm text-gray-700">
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Primer Plato</span>
                                                                <p className="truncate font-medium text-gray-900">{group?.menu?.first_course || '-'}</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Segundo Plato</span>
                                                                <p className="truncate font-medium text-gray-900">{group?.menu?.second_course || '-'}</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Guarnición</span>
                                                                <p className="truncate text-gray-600">{group?.menu?.side || '-'}</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Ensalada</span>
                                                                <p className="truncate text-gray-600">{group?.menu?.salad || '-'}</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Postre</span>
                                                                <p className="truncate font-medium text-gray-900">{group?.menu?.dessert || '-'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-end pt-2">
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                className="h-8 shadow-sm gap-2"
                                                                onClick={() => openMatrixModal(group)}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                                Configurar Menús Especiales
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                                                <Utensils className="h-12 w-12 text-gray-100 mx-auto mb-4" />
                                                <p className="text-gray-500 font-medium">No hay menús registrados para este día</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-4"
                                                    onClick={() => openNormalMenuModal()}
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Asignar Menú Principal
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Show "Add" button if there are unassigned schools, even if some menus already exist */}
                                {groupedMenus.length > 0 && unassignedSchoolsCount > 0 && (
                                    <div className="flex justify-center pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full py-6 border-dashed border-2 hover:border-indigo-300 hover:bg-indigo-50/30 text-indigo-600 transition-all gap-2"
                                            onClick={() => openNormalMenuModal()}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Asignar Menú a Colegios Restantes ({unassignedSchoolsCount})
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <Info className="h-10 w-10 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium">Selecciona un día en el calendario</p>
                            </div>
                        )}
                    </div>

                </div>

                {/* Normal Menu Assignment Modal */}
                <Modal
                    isOpen={isMenuModalOpen}
                    onClose={() => setIsMenuModalOpen(false)}
                    title={editingGroup ? "Editar Menú Principal" : "Asignar Menú Diario"}
                >
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Composición del Menú Principal</h4>
                            <div className="grid gap-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="first_course" className="text-sm font-medium">Primer Plato</Label>
                                    <Input id="first_course" value={formData.first_course} onChange={e => setFormData({ ...formData, first_course: e.target.value })} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="second_course" className="text-sm font-medium">Segundo Plato</Label>
                                    <Input id="second_course" value={formData.second_course} onChange={e => setFormData({ ...formData, second_course: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="side" className="text-sm font-medium">Guarnición</Label>
                                        <Input id="side" value={formData.side} onChange={e => setFormData({ ...formData, side: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="salad" className="text-sm font-medium">Ensalada</Label>
                                        <Input id="salad" value={formData.salad} onChange={e => setFormData({ ...formData, salad: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dessert" className="text-sm font-medium">Postre</Label>
                                    <Input id="dessert" value={formData.dessert} onChange={e => setFormData({ ...formData, dessert: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asignación de Colegios</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {schools.map(school => {
                                    const isAlreadyAssigned = assignedSchoolIds.has(school.id) && !editingGroup?.schoolIds.includes(school.id);
                                    const isSelected = formData.schoolIds.includes(school.id);

                                    return (
                                        <button
                                            key={school.id}
                                            type="button"
                                            disabled={isAlreadyAssigned}
                                            onClick={() => !isAlreadyAssigned && toggleSelection(school.id, 'schoolIds')}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                                isSelected
                                                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                                                    : isAlreadyAssigned
                                                        ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                                                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-4 w-4 rounded border flex items-center justify-center transition-all",
                                                isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300",
                                                isAlreadyAssigned && "bg-gray-200 border-gray-200"
                                            )}>
                                                {isSelected && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{school.name}</span>
                                                {isAlreadyAssigned && (
                                                    <span className="text-[10px] text-gray-400">Ya tiene un menú hoy</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alérgenos e Intolerancias (Principal)</h4>
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                {ALLERGENS.map(allergen => (
                                    <button
                                        key={allergen.id}
                                        type="button"
                                        onClick={() => toggleSelection(allergen.id, 'allergens')}
                                        title={allergen.name}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all gap-1",
                                            formData.allergens.includes(allergen.id)
                                                ? "border-red-200 bg-red-50 text-red-700 shadow-sm"
                                                : "border-gray-100 hover:border-gray-200 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                                        )}
                                    >
                                        <span className="text-xl">{allergen.icon}</span>
                                        <span className="text-[8px] font-bold text-center leading-tight truncate w-full">{allergen.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t border-gray-100 py-4 mt-4">
                            <Button variant="ghost" className="flex-1" onClick={() => setIsMenuModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1 gap-2" onClick={handleSaveAssignment}>
                                <Save className="h-4 w-4" />
                                Guardar Menú Normal
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Special Menus Matrix Modal */}
                <Modal
                    isOpen={isMatrixModalOpen}
                    onClose={() => setIsMatrixModalOpen(false)}
                    title="Configuración de Menús Especiales"
                    size="full"
                >
                    <div className="space-y-6 max-w-full overflow-x-auto pb-4">
                        <div className="min-w-[1200px]">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-3 border-b text-left bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            Componente
                                        </th>
                                        {Object.keys(matrixData).map(type => (
                                            <th key={type} className="p-3 border-b text-center bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                <Badge variant={getTypeBadgeVariant(type as MenuType)} className="mb-1 whitespace-nowrap">
                                                    {type.replace(/-/g, ' ')}
                                                </Badge>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: 'Primer Plato', field: 'first_course' },
                                        { label: 'Segundo Plato', field: 'second_course' },
                                        { label: 'Guarnición', field: 'side' },
                                        { label: 'Ensalada', field: 'salad' },
                                        { label: 'Postre', field: 'dessert' }
                                    ].map(row => (
                                        <tr key={row.field} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3 border-b text-sm font-bold text-gray-700 bg-white sticky left-0 z-10 w-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                                {row.label}
                                            </td>
                                            {Object.keys(matrixData).map(type => (
                                                <td key={type} className="p-2 border-b min-w-[220px]">
                                                    <Input
                                                        value={matrixData[type]?.[row.field] || ''}
                                                        onChange={e => updateMatrixField(type, row.field, e.target.value)}
                                                        className="h-9 text-xs focus:bg-white bg-gray-50/50 border-gray-100"
                                                        placeholder={`Escribir ${row.label.toLowerCase()}...`}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-gray-100">
                            <Button variant="ghost" className="flex-1" onClick={() => setIsMatrixModalOpen(false)}>
                                Descartar
                            </Button>
                            <Button className="flex-1 gap-2 shadow-lg shadow-indigo-100" onClick={handleSaveMatrix}>
                                <Save className="h-4 w-4" />
                                Guardar Todas las Variantes
                            </Button>
                        </div>
                    </div>
                </Modal>
            </main >
        </div >
    )
}
