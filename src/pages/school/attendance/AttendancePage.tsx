import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { ClassService, type Class } from '../../../services/classes.service';
import { ChildService, type Child } from '../../../services/children.service';
import { AttendanceService, type AttendanceRecord } from '../../../services/attendance.service';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
const monthBounds = (month: string) => ({
    from: `${month}-01`,
    to: `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}`,
});
const weekdayNumber = (date: Date) => date.getDay() === 0 ? 7 : date.getDay();

type CellStatus = 'present' | 'absent' | 'pending' | 'not-planned';

export default function AttendancePage() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [classes, setClasses] = useState<Class[]>([]);
    const [children, setChildren] = useState<Child[]>([]);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [month, setMonth] = useState(currentMonth());
    const [classId, setClassId] = useState('');
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let current = true;
        if (!schoolId) { setError('No se pudo identificar el colegio.'); setIsLoadingClasses(false); return; }
        ClassService.getClassesBySchool(schoolId).then(data => {
            if (!current) return;
            setClasses(data);
            setClassId(previous => previous || data[0]?.id || '');
            if (!data.length) setError('No hay aulas registradas para este colegio.');
        }).catch(err => {
            console.error('Error loading classes:', err);
            if (current) setError('No se pudo cargar la lista de aulas.');
        }).finally(() => { if (current) setIsLoadingClasses(false); });
        return () => { current = false; };
    }, [schoolId]);

    useEffect(() => {
        let current = true;
        const load = async () => {
            if (!schoolId || !classId || !month) { setChildren([]); setRecords([]); return; }
            try {
                setIsLoading(true);
                const bounds = monthBounds(month);
                const [allChildren, attendance] = await Promise.all([
                    ChildService.getChildrenBySchool(schoolId),
                    AttendanceService.getBySchool(schoolId, { dateFrom: bounds.from, dateTo: bounds.to, classId }),
                ]);
                if (!current) return;
                setChildren(allChildren.filter(child => child.class_id === classId && child.is_active));
                setRecords(attendance);
                setError(null);
            } catch (err) {
                console.error('Error loading monthly attendance:', err);
                if (current) setError('No se pudo cargar la asistencia del mes.');
            } finally { if (current) setIsLoading(false); }
        };
        void load();
        return () => { current = false; };
    }, [schoolId, classId, month]);

    const days = useMemo(() => {
        if (!month) return [];
        const [year, monthNumber] = month.split('-').map(Number);
        return Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, index) => {
            const date = new Date(year, monthNumber - 1, index + 1);
            return { iso: `${month}-${String(index + 1).padStart(2, '0')}`, date, number: index + 1,
                short: date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''), isWeekend: date.getDay() === 0 || date.getDay() === 6 };
        });
    }, [month]);
    const byChildAndDate = useMemo(() => new Map(records.map(record => [`${record.child_id}:${record.attendance_date}`, record])), [records]);
    const cellStatus = (child: Child, date: Date, iso: string): CellStatus => {
        const record = byChildAndDate.get(`${child.id}:${iso}`);
        if (record) return record.present ? 'present' : 'absent';
        return child.lunch_weekdays?.includes(weekdayNumber(date)) ? 'pending' : 'not-planned';
    };
    const clearFilters = () => { setMonth(currentMonth()); setClassId(classes[0]?.id || ''); };

    const marker = (status: CellStatus) => {
        const styles: Record<CellStatus, string> = {
            present: 'bg-emerald-100 text-emerald-700',
            absent: 'bg-red-100 text-red-700',
            pending: 'bg-amber-100 text-amber-700',
            'not-planned': 'text-gray-300',
        };
        const label: Record<CellStatus, string> = {
            present: '✓', absent: '×', pending: '·', 'not-planned': '—',
        };
        const accessible: Record<CellStatus, string> = {
            present: 'Asistió', absent: 'No asistió', pending: 'Día previsto, lista sin confirmar', 'not-planned': 'No previsto',
        };
        return <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${styles[status]}`} aria-label={accessible[status]} title={accessible[status]}>{label[status]}</span>;
    };

    return <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Asistencia</h1>
            <p className="text-sm text-gray-500">Consulta por día qué alumnos tenían previsto comer y si asistieron.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-primary-600" /><h2 className="font-semibold text-gray-900">Filtros</h2></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="attendance-month">Mes</Label><input id="attendance-month" type="month" value={month} onChange={event => setMonth(event.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm" /></div>
                <div className="space-y-2"><Label htmlFor="attendance-class">Aula</Label><select id="attendance-class" value={classId} onChange={event => setClassId(event.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm" disabled={isLoadingClasses || !classes.length}><option value="" disabled>{isLoadingClasses ? 'Cargando aulas…' : 'Selecciona un aula'}</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div className="flex items-end justify-end"><Button variant="outline" onClick={clearFilters} disabled={isLoading || isLoadingClasses}><RotateCcw className="mr-2 h-4 w-4" />Limpiar filtros</Button></div>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600" aria-label="Leyenda de asistencia">
            <span className="inline-flex items-center gap-2">{marker('pending')} Previsto, pendiente</span>
            <span className="inline-flex items-center gap-2">{marker('present')} Asistió</span>
            <span className="inline-flex items-center gap-2">{marker('absent')} No asistió</span>
            <span className="inline-flex items-center gap-2">{marker('not-planned')} No previsto</span>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        {isLoading || isLoadingClasses ? <div className="flex justify-center p-12" role="status"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : classId && <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-20 bg-gray-50"><tr>
                        <th scope="col" className="sticky left-0 z-30 min-w-44 border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700">Alumno</th>
                        {days.map(day => <th key={day.iso} scope="col" className={`border-b border-gray-200 py-3 text-center font-semibold ${day.isWeekend ? 'min-w-8 bg-gray-100 px-1 text-gray-400' : 'min-w-12 px-2 text-gray-700'}`} title={day.date.toLocaleDateString('es-ES', { dateStyle: 'full' })}><span className={`block text-[10px] font-normal uppercase ${day.isWeekend ? 'text-gray-300' : 'text-gray-400'}`}>{day.short}</span>{day.number}</th>)}
                    </tr></thead>
                    <tbody>{children.map(child => <tr key={child.id} className="hover:bg-gray-50/70">
                        <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-gray-100 bg-white px-4 py-2 text-left font-medium text-gray-700">{child.first_name} {child.last_name}</th>
                        {days.map(day => <td key={day.iso} className={`border-b border-gray-100 py-1.5 text-center ${day.isWeekend ? 'bg-gray-50 px-0.5' : 'px-2'}`}>{day.isWeekend ? <span className="text-[10px] text-gray-300" title="Fin de semana">·</span> : marker(cellStatus(child, day.date, day.iso))}</td>)}
                    </tr>)}</tbody>
                </table>
                {children.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No hay alumnos activos en esta aula.</p>}
            </div>
        </div>}
    </div>;
}
