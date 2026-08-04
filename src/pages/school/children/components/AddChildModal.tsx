import { useState } from "react"
import { Modal } from "../../../../components/ui/modal"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import type { Class } from "../../../../services/classes.service"
import type { Allergen } from "../../../../services/allergens.service"

interface AddChildModalProps {
    isOpen: boolean
    onClose: () => void
    classes: Class[]
    allergens: Allergen[]
    isLoading?: boolean
    onSave: (child: { first_name: string; last_name: string; class_id: string; allergenIds: string[] }) => void
}

export function AddChildModal({ isOpen, onClose, classes, allergens, isLoading, onSave }: AddChildModalProps) {
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [classId, setClassId] = useState('')
    const [selectedAllergens, setSelectedAllergens] = useState<string[]>([])

    const toggleAllergen = (allergenId: string) => {
        setSelectedAllergens(prev =>
            prev.includes(allergenId)
                ? prev.filter(id => id !== allergenId)
                : [...prev, allergenId]
        )
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!firstName || !lastName || !classId) return

        onSave({
            first_name: firstName,
            last_name: lastName,
            class_id: classId,
            allergenIds: selectedAllergens,
        })

        setFirstName('')
        setLastName('')
        setClassId('')
        setSelectedAllergens([])
        onClose()
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Inscribir Nuevo Alumno" size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-firstName">Nombre</Label>
                        <Input
                            id="add-firstName"
                            value={firstName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                            placeholder="Nombre del alumno"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="add-lastName">Apellidos</Label>
                        <Input
                            id="add-lastName"
                            value={lastName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                            placeholder="Apellidos del alumno"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="add-class">Clase</Label>
                    <select
                        id="add-class"
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                    >
                        <option value="">Selecciona una clase</option>
                        {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <Label>Alérgenos</Label>
                    {allergens.length === 0 ? (
                        <p className="text-sm text-gray-400">No hay alérgenos registrados</p>
                    ) : (
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-md">
                            {allergens.map(allergen => (
                                <label
                                    key={allergen.id}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                                        selectedAllergens.includes(allergen.id)
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedAllergens.includes(allergen.id)}
                                        onChange={() => toggleAllergen(allergen.id)}
                                        className="sr-only"
                                    />
                                    {allergen.name}
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Inscribiendo...' : 'Inscribir Alumno'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
