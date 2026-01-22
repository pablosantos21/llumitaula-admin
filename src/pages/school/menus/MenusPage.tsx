import { useState, useMemo } from 'react'
import { MOCK_MENUS } from '../../../mocks/menus'
import { MOCK_SCHOOLS } from '../../../mocks/schools'
import type { Menu, MenuType } from '../../../mocks/menus'
import { DataTable } from '../../../components/ui/data-table'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Calendar as CalendarIcon, Edit2, Trash2, List, Check, Utensils, Info, AlertCircle, Building2, Plus, Save } from 'lucide-react'
import { Calendar } from '../../../components/ui/calendar'
import { Modal } from '../../../components/ui/modal'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { cn } from '../../../lib/utils'

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

// Extended Menu for grouping demo
interface DailyMenuAssignment {
    menuId: string;
    schoolIds: string[];
    date: string; // YYYY-MM-DD
}

// Mock assignments for demo
const MOCK_ASSIGNMENTS: DailyMenuAssignment[] = [
    {
        menuId: '1', // General Lentejas
        schoolIds: ['1', '2'],
        date: new Date().toISOString().split('T')[0]
    },
    {
        menuId: '2', // General Pollo
        schoolIds: ['3'],
        date: new Date().toISOString().split('T')[0]
    },
    {
        menuId: '4', // Especial Sin Gluten
        schoolIds: ['1'],
        date: new Date().toISOString().split('T')[0]
    }
];


export default function MenusPage() {
    const [menus] = useState<Menu[]>(MOCK_MENUS)
    const [view, setView] = useState<'list' | 'calendar'>('calendar')
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
    const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
    const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<any>(null)

    // Form state for Normal Menu
    const [formData, setFormData] = useState({
        id: '',
        primero: '',
        segundo: '',
        guarnicion: '',
        ensalada: '',
        postre: '',
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
                primero: group.menu?.primero || '',
                segundo: group.menu?.segundo || '',
                guarnicion: group.menu?.guarnicion || '',
                ensalada: group.menu?.ensalada || '',
                postre: group.menu?.postre || '',
                schoolIds: group.schoolIds || [],
                allergens: group.menu?.allergens || []
            })
        } else {
            setEditingGroup(null)
            setFormData({
                id: '',
                primero: '',
                segundo: '',
                guarnicion: '',
                ensalada: '',
                postre: '',
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
            const variant = group.variations.find((v: any) => v.type === type)?.menu
            initialMatrix[type] = {
                primero: variant?.primero || group.menu?.primero || '',
                segundo: variant?.segundo || group.menu?.segundo || '',
                guarnicion: variant?.guarnicion || group.menu?.guarnicion || '',
                ensalada: variant?.ensalada || group.menu?.ensalada || '',
                postre: variant?.postre || group.menu?.postre || ''
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

    const handleSaveAssignment = () => {
        console.log('Saving assignment:', formData)
        setIsMenuModalOpen(false)
        alert('Menú normal guardado correctamente')
    }

    const handleSaveMatrix = () => {
        console.log('Saving special variations:', matrixData)
        setIsMatrixModalOpen(false)
        alert('Menus especiales actualizados')
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

    const columns = [
        {
            header: 'Nombre del Menú',
            accessor: (menu: Menu) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{menu.name}</span>
                    <span className="text-xs text-gray-400">ID: {menu.id}</span>
                </div>
            )
        },
        {
            header: 'Vigencia',
            accessor: (menu: Menu) => (
                <div className="flex items-center gap-2 text-xs">
                    <CalendarIcon className="h-3 w-3 text-gray-400" />
                    <span>{menu.startDate} al {menu.endDate}</span>
                </div>
            )
        },
        {
            header: 'Tipo',
            accessor: (menu: Menu) => (
                <Badge variant={getTypeBadgeVariant(menu.type)}>
                    {menu.type.replace('-', ' ')}
                </Badge>
            )
        },
        {
            header: 'Estado',
            accessor: (menu: Menu) => (
                <Badge variant={menu.isActive ? 'success' : 'default'}>
                    {menu.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (_menu: Menu) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    // Calculate school coverage for the calendar
    const getDayCoverage = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dayAssignments = MOCK_ASSIGNMENTS.filter(a => a.date === dateStr);
        const assignedSchoolIds = new Set(dayAssignments.flatMap(a => a.schoolIds));
        return {
            count: assignedSchoolIds.size,
            total: MOCK_SCHOOLS.length,
            isAll: assignedSchoolIds.size === MOCK_SCHOOLS.length && MOCK_SCHOOLS.length > 0,
            isWorkingDay: date.getDay() !== 0 && date.getDay() !== 6
        };
    };

    const renderCalendarDay = (date: Date) => {
        const coverage = getDayCoverage(date);
        if (!coverage.isWorkingDay) return null;

        return (
            <div className="mt-1 flex flex-col items-center">
                {coverage.isAll ? (
                    <div className="bg-emerald-100 rounded-full p-0.5">
                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                    </div>
                ) : coverage.count > 0 ? (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-100">
                        {coverage.count}/{coverage.total}
                    </span>
                ) : (
                    <AlertCircle className="h-3 w-3 text-gray-300" />
                )}
            </div>
        );
    };

    const groupedMenus = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = selectedDate.toISOString().split('T')[0];
        const dayAssignments = MOCK_ASSIGNMENTS.filter(a => a.date === dateStr);

        // Final grouped data for "Normal" menus
        const normalGroups = dayAssignments.map(assignment => {
            const menu = menus.find(m => m.id === assignment.menuId);
            const schools = MOCK_SCHOOLS.filter(s => assignment.schoolIds.includes(s.id));
            if (menu?.type !== 'normal') return null;

            // For each school in the group, find supported special types
            const supportedTypes = Array.from(new Set(schools.flatMap(s => s.supportedMenuTypes)))
                .filter(t => t !== 'normal');

            // Map variations
            const variations = supportedTypes.map(type => {
                const existingVariation = dayAssignments.find(a => {
                    const m = menus.find(menuItem => menuItem.id === a.menuId);
                    return m?.type === type && a.schoolIds.some(sid => assignment.schoolIds.includes(sid));
                });

                return {
                    type,
                    menu: existingVariation ? menus.find(m => m.id === existingVariation.menuId) : null,
                    schoolIds: assignment.schoolIds // Relevant schools for this variation (context of the normal menu)
                };
            });

            return {
                menu,
                schools,
                variations,
                schoolIds: assignment.schoolIds
            };
        }).filter(Boolean);

        return normalGroups;
    }, [selectedDate, menus]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Menús</h1>
                    <p className="text-sm text-gray-500">Consulta la cobertura de menús por día y colegio.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <Button
                        variant={view === 'list' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setView('list')}
                        className="flex items-center gap-2"
                    >
                        <List className="h-4 w-4" />
                        Lista
                    </Button>
                    <Button
                        variant={view === 'calendar' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setView('calendar')}
                        className="flex items-center gap-2"
                    >
                        <CalendarIcon className="h-4 w-4" />
                        Calendario
                    </Button>
                </div>
            </div>

            {view === 'list' ? (
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <DataTable columns={columns} data={menus} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Left Column (50%): Status Calendar */}
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Estado de Cobertura</h2>
                            <div className="flex gap-4 text-[10px] items-center">
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 bg-emerald-500 rounded-full" />
                                    <span>Completo</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 bg-amber-500 rounded-full" />
                                    <span>Parcial</span>
                                </div>
                            </div>
                        </div>
                        <Calendar
                            onDateClick={setSelectedDate}
                            renderDay={renderCalendarDay}
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
                        </div>

                        {selectedDate ? (
                            <div className="space-y-4">
                                {groupedMenus.length > 0 ? (
                                    groupedMenus.map((group, idx) => (
                                        <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="info" className="uppercase text-[10px] tracking-widest">NORMAL</Badge>
                                                    <span className="text-sm font-bold text-gray-900">{group?.menu?.name}</span>
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
                                                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                    <Building2 className="h-4 w-4 text-indigo-500 shrink-0" />
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {group?.schools.map(s => (
                                                            <span key={s.id} className="bg-white px-2 py-0.5 rounded border border-gray-200 font-medium text-gray-700 shadow-sm">
                                                                {s.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 py-4 border-y border-gray-100 italic text-sm text-gray-700">
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Primero</span>
                                                        <p className="truncate font-medium text-gray-900">{group?.menu?.primero || '-'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Segundo</span>
                                                        <p className="truncate font-medium text-gray-900">{group?.menu?.segundo || '-'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Guarnición</span>
                                                        <p className="truncate text-gray-600">{group?.menu?.guarnicion || '-'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Ensalada</span>
                                                        <p className="truncate text-gray-600">{group?.menu?.ensalada || '-'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Postre</span>
                                                        <p className="truncate font-medium text-gray-900">{group?.menu?.postre || '-'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2">
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Vigencia</span>
                                                        <p className="text-gray-500 text-xs">Del {group?.menu?.startDate} al {group?.menu?.endDate}</p>
                                                    </div>
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
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <Info className="h-10 w-10 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium">Selecciona un día en el calendario</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                <Label htmlFor="primero" className="text-sm font-medium">Primer Plato</Label>
                                <Input id="primero" value={formData.primero} onChange={e => setFormData({ ...formData, primero: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="segundo" className="text-sm font-medium">Segundo Plato</Label>
                                <Input id="segundo" value={formData.segundo} onChange={e => setFormData({ ...formData, segundo: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="guarnicion" className="text-sm font-medium">Guarnición</Label>
                                    <Input id="guarnicion" value={formData.guarnicion} onChange={e => setFormData({ ...formData, guarnicion: e.target.value })} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="ensalada" className="text-sm font-medium">Ensalada</Label>
                                    <Input id="ensalada" value={formData.ensalada} onChange={e => setFormData({ ...formData, ensalada: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="postre" className="text-sm font-medium">Postre</Label>
                                <Input id="postre" value={formData.postre} onChange={e => setFormData({ ...formData, postre: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asignación de Colegios</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {MOCK_SCHOOLS.map(school => (
                                <button
                                    key={school.id}
                                    type="button"
                                    onClick={() => toggleSelection(school.id, 'schoolIds')}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                        formData.schoolIds.includes(school.id)
                                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                                    )}
                                >
                                    <div className={cn(
                                        "h-4 w-4 rounded border flex items-center justify-center transition-all",
                                        formData.schoolIds.includes(school.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                                    )}>
                                        {formData.schoolIds.includes(school.id) && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium">{school.name}</span>
                                </button>
                            ))}
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
                                    { label: 'Primer Plato', field: 'primero' },
                                    { label: 'Segundo Plato', field: 'segundo' },
                                    { label: 'Guarnición', field: 'guarnicion' },
                                    { label: 'Ensalada', field: 'ensalada' },
                                    { label: 'Postre', field: 'postre' }
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
        </div>
    )
}
