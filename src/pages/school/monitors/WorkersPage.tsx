import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Edit2, Loader2, Plus, Users } from 'lucide-react';
import { WorkerService, type Worker } from '../../../services/workers.service';
import { MonitorService } from '../../../services/monitors.service';
import { DataTable } from '../../../components/ui/data-table';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const CODE_PATTERN = /^\d{3,4}$/;

export default function WorkersPage() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [editing, setEditing] = useState<Worker | null>(null);
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Create monitor state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

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

    const closeCreate = () => {
        setIsCreateOpen(false);
        setNewFirstName('');
        setNewLastName('');
        setNewCode('');
        setFormError(null);
    };

    const create = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!schoolId || !newFirstName.trim() || !newLastName.trim() || !newCode.trim()) return;

        if (!CODE_PATTERN.test(newCode.trim())) {
            setFormError('El código debe tener entre 3 y 4 dígitos numéricos.');
            return;
        }

        try {
            setIsCreating(true);
            setFormError(null);
            await MonitorService.createMonitor(
                { first_name: newFirstName, last_name: newLastName, code: newCode.trim() },
                schoolId
            );
            closeCreate();
            await load();
        } catch (err) {
            console.error('Error creating monitor:', err);
            setFormError((err as { code?: string }).code === '23505'
                ? 'Ese código ya está en uso en esta escuela.'
                : 'No se pudo crear el monitor. Inténtalo de nuevo.');
        } finally {
            setIsCreating(false);
        }
    };

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
            accessor: (worker: Worker) => <div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-bold"><Users className="h-4 w-4" /></div><span className="font-semibold">{worker.full_name}</span></div>,
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (worker: Worker) => <div className="flex justify-end gap-2"><Button variant="ghost" size="icon" title="Editar" onClick={() => startEdit(worker)} disabled={isSaving}><Edit2 className="h-4 w-4" /></Button></div>,
        },
    ];

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" /></div>;
    if (error && workers.length === 0) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700">{error}</div>;

    return <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Trabajadores</h1><p className="text-sm text-gray-500">Gestión de monitores del comedor.</p></div>
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 self-start sm:self-auto">
                <Plus className="h-4 w-4" />
                Nuevo Monitor
            </Button>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        <DataTable columns={columns} data={workers} />
        <Modal isOpen={isCreateOpen} onClose={closeCreate} title="Añadir nuevo monitor">
            <form onSubmit={create} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="monitor-first-name">Nombre</Label>
                        <Input id="monitor-first-name" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Ej. Ana" required autoFocus />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="monitor-last-name">Apellidos</Label>
                        <Input id="monitor-last-name" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Ej. García López" required />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="monitor-code">Código de Acceso (PIN)</Label>
                    <Input
                        id="monitor-code"
                        value={newCode}
                        onChange={(e) => {
                            setNewCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                            setFormError(null);
                        }}
                        placeholder="Ej. 1234"
                        inputMode="numeric"
                        maxLength={4}
                        autoComplete="off"
                        required
                    />
                    <p className="text-xs text-gray-500">
                        PIN de 3-4 dígitos. Será la contraseña que el monitor usará para entrar a su panel.
                    </p>
                </div>
                {formError && (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">{formError}</p>
                )}
                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={closeCreate} disabled={isCreating}>Cancelar</Button>
                    <Button type="submit" disabled={isCreating || !newFirstName.trim() || !newLastName.trim() || !newCode.trim()} className="bg-primary-600 hover:bg-primary-700 text-white">
                        {isCreating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            'Crear monitor'
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
        <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Editar trabajador" size="xl">
            <form onSubmit={save} className="space-y-5">
                <div className="space-y-2"><Label htmlFor="worker-name">Nombre</Label><Input id="worker-name" value={name} onChange={event => setName(event.target.value)} required /></div>
                <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</Button></div>
            </form>
        </Modal>
    </div>;
}
