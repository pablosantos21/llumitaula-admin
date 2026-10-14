import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
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
    const shiftMonth = (delta: number) => {
        const [year, monthNumber] = month.split('-').map(Number);
        const date = new Date(year, monthNumber - 1 + delta, 1);
        setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };
    const monthLabel = useMemo(() => {
        const [year, monthNumber] = month.split('-').map(Number);
        if (!year || !monthNumber) return month;
        const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }, [month]);

    const marker = (status: CellStatus, size: 'sm' | 'md' = 'md') => {
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
        const sizeClass = size === 'sm' ? 'h-5 w-5 text-xs' : 'h-6 w-6 text-sm';
        return <span className={`inline-flex ${sizeClass} items-center justify-center rounded-full font-semibold ${styles[status]}`} aria-label={accessible[status]} title={accessible[status]}>{label[status]}</span>;
    };

    return <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"><ChevronLeft className="h-4 w-4" /></button>
                        <span className="min-w-32 text-center text-sm font-semibold capitalize text-gray-900">{monthLabel}</span>
                        <button type="button" onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <select id="attendance-class" value={classId} onChange={event => setClassId(event.target.value)} aria-label="Aula" className="h-8 w-44 rounded-md border border-gray-200 px-2 text-sm" disabled={isLoadingClasses || !classes.length}><option value="" disabled>{isLoadingClasses ? 'Cargando aulas…' : 'Selecciona un aula'}</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600" aria-label="Leyenda de asistencia">
                    <span className="inline-flex items-center gap-1.5">{marker('pending', 'sm')} Previsto</span>
                    <span className="inline-flex items-center gap-1.5">{marker('present', 'sm')} Asistió</span>
                    <span className="inline-flex items-center gap-1.5">{marker('absent', 'sm')} No asistió</span>
                    <span className="inline-flex items-center gap-1.5">{marker('not-planned', 'sm')} No previsto</span>
                </div>
            </div>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        {isLoading || isLoadingClasses ? <div className="flex justify-center p-12" role="status"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : classId && <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="max-h-[75vh] overflow-auto">
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
