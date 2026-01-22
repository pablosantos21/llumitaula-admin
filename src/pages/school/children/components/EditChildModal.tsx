import { useState, useEffect } from "react"
import { Modal } from "../../../../components/ui/modal"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import type { Child } from "../../../../mocks/children"
import { MOCK_HEALTH_TAGS } from "../../../../mocks/children"

interface EditChildModalProps {
    isOpen: boolean
    onClose: () => void
    child: Child | null
    onSave: (updatedChild: Child) => void
}

export function EditChildModal({ isOpen, onClose, child, onSave }: EditChildModalProps) {
    const [name, setName] = useState('')
    const [className, setClassName] = useState('')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [observations, setObservations] = useState('')
    const [course, setCourse] = useState<'Infantil' | 'Primaria' | 'ESO'>('Primaria')

    useEffect(() => {
        if (child) {
            setName(child.name)
            setClassName(child.class)
            setSelectedTags(child.health || [])
            setObservations(child.observations)
            setCourse(child.course)
        }
    }, [child, isOpen])

    const handleToggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag))
        } else {
            setSelectedTags([...selectedTags, tag])
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (child) {
            onSave({
                ...child,
                name,
                class: className,
                health: selectedTags,
                observations,
                course
            })
        }
        onClose()
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Alumno" size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre Completo</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            placeholder="Nombre del alumno"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="class">Clase</Label>
                        <Input
                            id="class"
                            value={className}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClassName(e.target.value)}
                            placeholder="Ej: 1º Primaria A"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="course">Curso</Label>
                    <div className="flex gap-2">
                        {(['Infantil', 'Primaria', 'ESO'] as const).map((c) => (
                            <Button
                                key={c}
                                type="button"
                                variant={course === c ? 'primary' : 'ghost'}
                                className="flex-1"
                                onClick={() => setCourse(c)}
                            >
                                {c}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <Label>Salud y Alergias</Label>
                    <div className="p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                        <div className="flex flex-wrap gap-2">
                            {MOCK_HEALTH_TAGS.map((tag: string) => {
                                const isSelected = selectedTags.includes(tag)
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => handleToggleTag(tag)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${isSelected
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="observations">Observaciones</Label>
                    <textarea
                        id="observations"
                        className="w-full flex min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm"
                        value={observations}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservations(e.target.value)}
                        placeholder="Otras consideraciones..."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit">
                        Guardar Cambios
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
