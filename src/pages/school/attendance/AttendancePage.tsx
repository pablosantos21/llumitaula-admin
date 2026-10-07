import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { DataTable } from '../../../components/ui/data-table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { ClassService, type Class } from '../../../services/classes.service';
import { AttendanceService, type AttendanceRecord } from '../../../services/attendance.service';
import { getConfirmationMeta, summarizeDailyAttendance } from '../../../lib/attendance';

const todayLocal = () => new Date().toLocaleDateString('en-CA');

const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString();

export default function AttendancePage() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedDate, setSelectedDate] = useState(todayLocal());
    const [selectedClassId, setSelectedClassId] = useState('');
    const [onlyPresent, setOnlyPresent] = useState(false);
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
                const [attendance, classData] = await Promise.all([
                    AttendanceService.getBySchool(schoolId, {
                        date: selectedDate || undefined,
                        classId: selectedClassId || undefined,
                    }),
                    ClassService.getClassesBySchool(schoolId),
                ]);
                if (current) {
                    setRecords(attendance);
                    setClasses(classData);
                    setError(null);
                }
            } catch (err) {
                console.error('Error loading attendance:', err);
                if (current) setError('No se pudo cargar la lista confirmada.');
            } finally {
                if (current) setIsLoading(false);
            }
        };
        void load();
        return () => {
            current = false;
        };
    }, [schoolId, selectedDate, selectedClassId]);

    const summary = useMemo(() => summarizeDailyAttendance(records), [records]);
    const confirmation = useMemo(() => getConfirmationMeta(records), [records]);
    const isSingleList = selectedDate !== '' && selectedClassId !== '';
    const attributableConfirmation = isSingleList ? confirmation : null;
    const visibleRecords = useMemo(
        () => (onlyPresent ? records.filter(record => record.present) : records),
        [records, onlyPresent],
    );

    const clearFilters = () => {
        setSelectedDate(todayLocal());
        setSelectedClassId('');
        setOnlyPresent(false);
    };

    const columns = [
        { header: 'Fecha', accessor: (record: AttendanceRecord) => formatDate(record.attendance_date) },
        { header: 'Niño', accessor: (record: AttendanceRecord) => `${record.child_first_name} ${record.child_last_name}`.trim() || 'Sin nombre' },
        { header: 'Aula', accessor: (record: AttendanceRecord) => record.class_name || 'Sin aula' },
        {
            header: 'Estado',
            accessor: (record: AttendanceRecord) => (
                <Badge variant={record.present ? 'success' : 'default'}>{record.present ? 'Presente' : 'Ausente'}</Badge>
            ),
        },
        {
            header: 'Confirmado por',
            accessor: (record: AttendanceRecord) => record.confirmer_name ?? 'Sin registrar',
        },
        { header: 'Confirmado el', accessor: (record: AttendanceRecord) => formatDateTime(record.confirmed_at) },
    ];

    const summaryBanner = () => {
        if (summary.status === 'never-passed') {
            return (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600" role="status">
                    Aún no se ha pasado lista para esta fecha. Sin lista confirmada no hay presentes valorables.
                </div>
            );
        }
        if (summary.status === 'confirmed-empty') {
            return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
                    Lista confirmada vacía: hoy no vino nadie
                    {attributableConfirmation ? ` (confirmada por ${attributableConfirmation.confirmerName ?? 'desconocido'} el ${formatDateTime(attributableConfirmation.confirmedAt)})` : ''}.
                    Se distingue de un día aún no pasado.
                </div>
            );
        }
        return (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                {summary.presentCount} presente{summary.presentCount === 1 ? '' : 's'} de {summary.total}
                {attributableConfirmation ? ` · Confirmada por ${attributableConfirmation.confirmerName ?? 'desconocido'} el ${formatDateTime(attributableConfirmation.confirmedAt)}` : ' · Varias listas: consulta quién confirmó cada fila en la tabla'}.
                Solo los presentes admiten valoración posterior.
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Asistencia</h1>
                <p className="text-sm text-gray-500">Consulta la lista confirmada de cada clase y día: quién vino y quién la confirmó.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary-600" />
                    <h2 className="font-semibold text-gray-900">Filtros</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="attendance-date">Fecha</Label>
                        <Input id="attendance-date" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="attendance-class">Aula</Label>
                        <select
                            id="attendance-class"
                            value={selectedClassId}
                            onChange={event => setSelectedClassId(event.target.value)}
                            className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                        >
                            <option value="">Todas las aulas</option>
                            {classes.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                checked={onlyPresent}
                                onChange={event => setOnlyPresent(event.target.checked)}
                            />
                            Solo presentes (filtro del registro posterior)
                        </label>
                    </div>
                </div>
                <div className="mt-5 flex justify-end">
                    <Button variant="outline" onClick={clearFilters} disabled={isLoading}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Limpiar filtros
                    </Button>
                </div>
            </div>
            {summaryBanner()}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                    {error}
                </div>
            )}
            {isLoading ? (
                <div className="flex justify-center p-12" role="status">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={visibleRecords}
                    emptyMessage={
                        summary.status === 'never-passed'
                            ? 'No hay lista confirmada para estos filtros.'
                            : 'Ningún registro coincide con los filtros.'
                    }
                />
            )}
        </div>
    );
}
