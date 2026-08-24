import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Edit2, Loader2, Power, Users } from 'lucide-react';
import { WorkerService, type Worker, type WorkerRole } from '../../../services/workers.service';
import { ClassService, type Class } from '../../../services/classes.service';
import { DataTable } from '../../../components/ui/data-table';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

export default function WorkersPage() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [editing, setEditing] = useState<Worker | null>(null);
    const [name, setName] = useState('');
    const [role, setRole] = useState<WorkerRole>('worker');
    const [active, setActive] = useState(true);
    const [classIds, setClassIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!schoolId) return;
        try {
            setIsLoading(true);
            const [workerData, classData] = await Promise.all([
                WorkerService.getBySchool(schoolId),
                ClassService.getClassesBySchool(schoolId),
            ]);
            setWorkers(workerData);
            setClasses(classData);
        } catch (err) {
            console.error('Error loading workers:', err);
            setError('No se pudieron cargar los trabajadores');
        } finally {
            setIsLoading(false);
        }
    }, [schoolId]);

    useEffect(() => { void load(); }, [load]);

    const startEdit = (worker: Worker) => {
        setEditing(worker);
        setName(worker.full_name);
        setRole(worker.role);
        setActive(worker.active);
        setClassIds(worker.worker_classrooms?.map(assignment => assignment.class_id) || []);
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editing || !name.trim()) return;
        try {
            setIsSaving(true);
            await WorkerService.update(editing.id, { full_name: name.trim(), role, active });
            await WorkerService.setClassrooms(editing.id, classIds);
            setEditing(null);
            await load();
        } catch (err) {
            console.error('Error updating worker:', err);
            setError('No se pudo guardar el trabajador');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (worker: Worker) => {
        try {
            setIsSaving(true);
            await WorkerService.update(worker.id, {
                full_name: worker.full_name,
                role: worker.role,
                active: !worker.active,
            });
            setWorkers(current => current.map(item => item.id === worker.id ? { ...item, active: !item.active } : item));
        } catch (err) {
            console.error('Error changing worker state:', err);
            setError('No se pudo cambiar el estado del trabajador');
        } finally {
            setIsSaving(false);
        }
    };

    const columns = [
        {
            header: 'Trabajador',
            accessor: (worker: Worker) => <div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold"><Users className="h-4 w-4" /></div><span className="font-semibold">{worker.full_name}</span></div>,
        },
        { header: 'Rol', accessor: (worker: Worker) => <span className="capitalize">{worker.role}</span> },
        { header: 'Aulas', accessor: (worker: Worker) => worker.worker_classrooms?.length || 0 },
        {
            header: 'Estado',
            accessor: (worker: Worker) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${worker.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{worker.active ? 'Activo' : 'Inactivo'}</span>,
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (worker: Worker) => <div className="flex justify-end gap-2"><Button variant="ghost" size="icon" title="Editar" onClick={() => startEdit(worker)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={worker.active ? 'Desactivar' : 'Activar'} onClick={() => void toggleActive(worker)}><Power className={`h-4 w-4 ${worker.active ? 'text-red-500' : 'text-green-600'}`} /></Button></div>,
        },
    ];

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>;
    if (error && workers.length === 0) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700">{error}</div>;

    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Trabajadores</h1><p className="text-sm text-gray-500">Gestiona su estado, rol y aulas asignadas.</p></div>
        <DataTable columns={columns} data={workers} />
        <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Editar trabajador" size="xl">
            <form onSubmit={save} className="space-y-5">
                <div className="space-y-2"><Label htmlFor="worker-name">Nombre</Label><Input id="worker-name" value={name} onChange={event => setName(event.target.value)} required /></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="worker-role">Rol</Label><select id="worker-role" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={role} onChange={event => setRole(event.target.value as WorkerRole)}><option value="worker">Trabajador</option><option value="monitor">Monitor</option><option value="supervisor">Supervisor</option></select></div><label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} /> Activo</label></div>
                <div className="space-y-2"><Label>Aulas asignadas</Label><div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-gray-200 p-3 sm:grid-cols-2">{classes.map(classroom => <label key={classroom.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={classIds.includes(classroom.id)} onChange={event => setClassIds(current => event.target.checked ? [...current, classroom.id] : current.filter(id => id !== classroom.id))} />{classroom.name}{!classroom.is_active && <span className="text-xs text-gray-400">(inactiva)</span>}</label>)}</div></div>
                <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</Button></div>
            </form>
        </Modal>
    </div>;
}
