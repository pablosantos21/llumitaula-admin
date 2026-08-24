import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Edit2, Loader2, Users } from 'lucide-react';
import { WorkerService, type Worker } from '../../../services/workers.service';
import { DataTable } from '../../../components/ui/data-table';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

export default function WorkersPage() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [editing, setEditing] = useState<Worker | null>(null);
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!schoolId) return;
        try {
            setIsLoading(true);
            const workerData = await WorkerService.getBySchool(schoolId);
            setWorkers(workerData);
            setError(null);
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
        setError(null);
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editing || !name.trim()) return;
        try {
            setIsSaving(true);
            setError(null);
            await WorkerService.update(editing.id, { full_name: name.trim() });
            setEditing(null);
            await load();
        } catch (err) {
            console.error('Error updating worker:', err);
            setError('No se pudo guardar el trabajador');
        } finally {
            setIsSaving(false);
        }
    };

    const columns = [
        {
            header: 'Trabajador',
            accessor: (worker: Worker) => <div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold"><Users className="h-4 w-4" /></div><span className="font-semibold">{worker.full_name}</span></div>,
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (worker: Worker) => <div className="flex justify-end gap-2"><Button variant="ghost" size="icon" title="Editar" onClick={() => startEdit(worker)} disabled={isSaving}><Edit2 className="h-4 w-4" /></Button></div>,
        },
    ];

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>;
    if (error && workers.length === 0) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700">{error}</div>;

    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Trabajadores</h1><p className="text-sm text-gray-500">Gestión de monitores del comedor.</p></div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        <DataTable columns={columns} data={workers} />
        <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Editar trabajador" size="xl">
            <form onSubmit={save} className="space-y-5">
                <div className="space-y-2"><Label htmlFor="worker-name">Nombre</Label><Input id="worker-name" value={name} onChange={event => setName(event.target.value)} required /></div>
                <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</Button></div>
            </form>
        </Modal>
    </div>;
}
