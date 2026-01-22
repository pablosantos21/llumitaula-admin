import { Modal } from "../../../../components/ui/modal"
import { Badge } from "../../../../components/ui/badge"
import { MOCK_HEALTH_TAGS } from "../../../../mocks/children"

interface HealthTagsModalProps {
    isOpen: boolean
    onClose: () => void
}

export function HealthTagsModal({ isOpen, onClose }: HealthTagsModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestión de Etiquetas de Salud" size="md">
            <div className="space-y-4">
                <p className="text-sm text-gray-500">
                    Estas son las etiquetas disponibles que se pueden asignar a los alumnos para indicar alergias, patologías o dietas especiales.
                </p>
                <div className="flex flex-wrap gap-2">
                    {MOCK_HEALTH_TAGS.map((tag: string) => (
                        <Badge key={tag} variant="default" className="px-3 py-1 text-sm">
                            {tag}
                        </Badge>
                    ))}
                </div>
            </div>
        </Modal>
    )
}
