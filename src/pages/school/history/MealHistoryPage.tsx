import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { DataTable } from '../../../components/ui/data-table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { ClassService, type Class } from '../../../services/classes.service';
import { ChildService, type Child } from '../../../services/children.service';
import { WorkerService, type Worker } from '../../../services/workers.service';
import { MealHistoryService, type MealHistoryFilters, type MealHistoryRecord } from '../../../services/meal-history.service';

const initialFilters: MealHistoryFilters = {};

const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString();

export default function MealHistoryPage() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [records, setRecords] = useState<MealHistoryRecord[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [children, setChildren] = useState<Child[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [filters, setFilters] = useState<MealHistoryFilters>(initialFilters);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let current = true;
        const load = async () => {
            if (!schoolId) {
                setError('No se pudo identificar el colegio.');
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                const [history, classData, childData, workerData] = await Promise.all([
                    MealHistoryService.getBySchool(schoolId, filters),
                    classes.length ? Promise.resolve(classes) : ClassService.getClassesBySchool(schoolId),
                    children.length ? Promise.resolve(children) : ChildService.getChildrenBySchool(schoolId),
                    workers.length ? Promise.resolve(workers) : WorkerService.getBySchool(schoolId),
                ]);
                if (current) {
                    setRecords(history);
                    setClasses(classData);
                    setChildren(childData);
                    setWorkers(workerData);
                    setError(null);
                }
            } catch (err) {
                console.error('Error loading meal history:', err);
                if (current) setError('No se pudo cargar el historial de comidas.');
            } finally {
                if (current) setIsLoading(false);
            }
        };
        void load();
        return () => { current = false; };
    }, [schoolId, filters, classes, children, workers]);

    const updateFilter = (key: keyof MealHistoryFilters, value: string) => {
        setFilters(current => ({ ...current, [key]: value || undefined }));
    };

    const clearFilters = () => setFilters(initialFilters);

    const columns = [
        { header: 'Fecha', accessor: (record: MealHistoryRecord) => formatDate(record.meal_date) },
        { header: 'Tipo', accessor: (record: MealHistoryRecord) => <span className="capitalize">{record.meal_type}</span> },
        { header: 'Niño', accessor: (record: MealHistoryRecord) => `${record.children.first_name} ${record.children.last_name}` },
        { header: 'Aula', accessor: (record: MealHistoryRecord) => record.classes.name },
        { header: 'Trabajador', accessor: (record: MealHistoryRecord) => record.worker?.full_name || 'Sin registrar' },
        { header: 'Valoración', accessor: (record: MealHistoryRecord) => record.rating ? `${record.rating}/5` : 'Sin valorar' },
    ];

    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Historial de comidas</h1><p className="text-sm text-gray-500">Consulta y filtra las comidas registradas en este colegio.</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-indigo-600" /><h2 className="font-semibold text-gray-900">Filtros</h2></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"><div className="space-y-2"><Label htmlFor="history-date">Fecha</Label><Input id="history-date" type="date" value={filters.date || ''} onChange={event => updateFilter('date', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="history-class">Aula</Label><select id="history-class" value={filters.classId || ''} onChange={event => updateFilter('classId', event.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"><option value="">Todas las aulas</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="history-child">Niño</Label><select id="history-child" value={filters.childId || ''} onChange={event => updateFilter('childId', event.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"><option value="">Todos los niños</option>{children.map(item => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="history-worker">Trabajador</Label><select id="history-worker" value={filters.workerId || ''} onChange={event => updateFilter('workerId', event.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"><option value="">Todos los trabajadores</option>{workers.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="history-type">Tipo de comida</Label><select id="history-type" value={filters.mealType || ''} onChange={event => updateFilter('mealType', event.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"><option value="">Todos los tipos</option><option value="desayuno">Desayuno</option><option value="comida">Comida</option><option value="merienda">Merienda</option><option value="cena">Cena</option></select></div><div className="space-y-2"><Label htmlFor="history-rating">Valoración</Label><select id="history-rating" value={filters.rating || ''} onChange={event => updateFilter('rating', event.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"><option value="">Todas las valoraciones</option>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating}/5</option>)}</select></div></div><div className="mt-5 flex justify-end"><Button variant="outline" onClick={clearFilters} disabled={isLoading}><RotateCcw className="mr-2 h-4 w-4" />Limpiar filtros</Button></div></div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        {isLoading ? <div className="flex justify-center p-12" role="status"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : <DataTable columns={columns} data={records} emptyMessage="No hay comidas que coincidan con los filtros." />}
    </div>;
}
