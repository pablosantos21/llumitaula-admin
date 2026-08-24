import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Edit2, KeyRound, Loader2, Plus, Smartphone, Ban } from 'lucide-react';
import { DeviceService, type Device } from '../../../services/devices.service';
import { DataTable } from '../../../components/ui/data-table';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

type Mutation = 'create' | 'rename' | 'revoke' | 'code' | null;

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : 'Nunca';

export default function DevicesPage() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mutation, setMutation] = useState<Mutation>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [deviceToRename, setDeviceToRename] = useState<Device | null>(null);
    const [rename, setRename] = useState('');
    const [deviceToRevoke, setDeviceToRevoke] = useState<Device | null>(null);
    const [configCode, setConfigCode] = useState<string | null>(null);

    useEffect(() => {
        let current = true;
        const load = async () => {
            if (!schoolId) {
                setLoadError('No se pudo identificar el colegio.');
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                const data = await DeviceService.getBySchool(schoolId);
                if (current) {
                    setDevices(data);
                    setLoadError(null);
                }
            } catch (err) {
                console.error('Error loading devices:', err);
                if (current) setLoadError('No se pudieron cargar los dispositivos.');
            } finally {
                if (current) setIsLoading(false);
            }
        };
        void load();
        return () => { current = false; };
    }, [schoolId]);

    const runMutation = async <T,>(operation: () => Promise<T>, message: string): Promise<T | null> => {
        try {
            setError(null);
            return await operation();
        } catch (err) {
            console.error(message, err);
            setError(message);
            return null;
        }
    };

    const createDevice = async (event: React.FormEvent) => {
        event.preventDefault();
        const name = newName.trim();
        if (!schoolId || !name) return;
        setMutation('create');
        const device = await runMutation(() => DeviceService.create(schoolId, name), 'No se pudo crear el dispositivo.');
        if (device) {
            setDevices(current => [...current, device].sort((a, b) => a.name.localeCompare(b.name)));
            setNewName('');
            setIsCreateOpen(false);
            await generateCode(device);
        }
        setMutation(null);
    };

    const renameDevice = async (event: React.FormEvent) => {
        event.preventDefault();
        const name = rename.trim();
        if (!deviceToRename || !name) return;
        setMutation('rename');
        const device = await runMutation(() => DeviceService.rename(deviceToRename.id, name), 'No se pudo renombrar el dispositivo.');
        if (device) {
            setDevices(current => current.map(item => item.id === device.id ? device : item));
            setDeviceToRename(null);
        }
        setMutation(null);
    };

    const revokeDevice = async () => {
        if (!deviceToRevoke) return;
        setMutation('revoke');
        const device = await runMutation(() => DeviceService.revoke(deviceToRevoke.id), 'No se pudo revocar el dispositivo.');
        if (device) {
            setDevices(current => current.map(item => item.id === device.id ? device : item));
            setDeviceToRevoke(null);
        }
        setMutation(null);
    };

    const generateCode = async (device: Device) => {
        setMutation('code');
        const code = await runMutation(() => DeviceService.generateConfigCode(device.id), 'No se pudo generar el código de configuración.');
        if (code) setConfigCode(code);
        setMutation(null);
    };

    const columns = [
        { header: 'Dispositivo', accessor: (device: Device) => <div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-indigo-600" /><span className="font-semibold text-gray-900">{device.name}</span></div> },
        { header: 'Estado', accessor: (device: Device) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${device.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{device.active ? 'Activo' : 'Revocado'}</span> },
        { header: 'Última conexión', accessor: (device: Device) => <span>{formatDate(device.last_seen_at)}</span> },
        { header: 'Acciones', className: 'text-right', accessor: (device: Device) => <div className="flex justify-end gap-2"><Button variant="ghost" size="icon" title="Renombrar" onClick={() => { setDeviceToRename(device); setRename(device.name); setError(null); }} disabled={mutation !== null}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Generar código" onClick={() => void generateCode(device)} disabled={!device.active || mutation !== null}><KeyRound className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Revocar" onClick={() => { setDeviceToRevoke(device); setError(null); }} disabled={!device.active || mutation !== null}><Ban className="h-4 w-4 text-red-500" /></Button></div> },
    ];

    if (isLoading) return <div className="flex flex-col items-center justify-center p-12" role="status"><Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-600" /><p className="text-gray-500">Cargando dispositivos...</p></div>;
    if (loadError) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700" role="alert">{loadError}</div>;

    return <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-gray-900">Dispositivos</h1><p className="text-sm text-gray-500">Gestiona los dispositivos conectados a este colegio.</p></div><Button onClick={() => { setError(null); setIsCreateOpen(true); }} disabled={mutation !== null}><Plus className="mr-2 h-4 w-4" />Nuevo dispositivo</Button></div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        <DataTable columns={columns} data={devices} emptyMessage="No hay dispositivos registrados para este colegio." />

        <Modal isOpen={isCreateOpen} onClose={() => mutation !== 'create' && setIsCreateOpen(false)} title="Nuevo dispositivo"><form onSubmit={createDevice} className="space-y-6"><div className="space-y-2"><Label htmlFor="device-name">Nombre</Label><Input id="device-name" value={newName} onChange={event => setNewName(event.target.value)} placeholder="Ej. Tablet comedor" required disabled={mutation === 'create'} autoFocus /></div><div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={mutation === 'create'}>Cancelar</Button><Button type="submit" disabled={mutation === 'create' || !newName.trim()}>{mutation === 'create' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : 'Crear dispositivo'}</Button></div></form></Modal>
        <Modal isOpen={!!deviceToRename} onClose={() => mutation !== 'rename' && setDeviceToRename(null)} title="Renombrar dispositivo"><form onSubmit={renameDevice} className="space-y-6"><div className="space-y-2"><Label htmlFor="rename-device">Nombre</Label><Input id="rename-device" value={rename} onChange={event => setRename(event.target.value)} required disabled={mutation === 'rename'} autoFocus /></div><div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setDeviceToRename(null)} disabled={mutation === 'rename'}>Cancelar</Button><Button type="submit" disabled={mutation === 'rename' || !rename.trim()}>{mutation === 'rename' ? 'Guardando...' : 'Guardar cambios'}</Button></div></form></Modal>
        <Modal isOpen={!!deviceToRevoke} onClose={() => mutation !== 'revoke' && setDeviceToRevoke(null)} title="Revocar dispositivo"><div className="space-y-5"><p className="text-gray-600">¿Quieres revocar <strong>{deviceToRevoke?.name}</strong>? El dispositivo dejará de poder utilizarse.</p><div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setDeviceToRevoke(null)} disabled={mutation === 'revoke'}>Cancelar</Button><Button variant="danger" onClick={() => void revokeDevice()} disabled={mutation === 'revoke'}>{mutation === 'revoke' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Revocando...</> : 'Revocar dispositivo'}</Button></div></div></Modal>
        <Modal isOpen={!!configCode} onClose={() => setConfigCode(null)} title="Código de configuración"><div className="space-y-5"><div className="rounded-lg bg-gray-100 p-4 text-center font-mono text-lg tracking-wider">{configCode}</div><p className="text-sm text-gray-500">Guarda este código ahora. Por seguridad, no se volverá a mostrar.</p><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => configCode && void navigator.clipboard?.writeText(configCode)}><Copy className="mr-2 h-4 w-4" />Copiar</Button><Button onClick={() => setConfigCode(null)}>Cerrar</Button></div></div></Modal>
    </div>;
}
