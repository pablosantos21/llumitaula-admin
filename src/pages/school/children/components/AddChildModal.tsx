import { Modal } from "../../../../components/ui/modal"
import type { Class } from "../../../../services/classes.service"
import type { Allergen } from "../../../../services/allergens.service"
import { ChildForm, type ChildFormData } from "./ChildForm"

interface AddChildModalProps {
    isOpen: boolean
    onClose: () => void
    classes: Class[]
    allergens: Allergen[]
    isLoading?: boolean
    onSave: (child: ChildFormData) => Promise<boolean>
}

export function AddChildModal({ isOpen, onClose, classes, allergens, isLoading, onSave }: AddChildModalProps) {
    if (!isOpen) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Inscribir Nuevo Alumno" size="lg">
            <ChildForm
                classes={classes}
                allergens={allergens}
                isLoading={isLoading}
                submitLabel="Inscribir Alumno"
                loadingLabel="Inscribiendo..."
                onCancel={onClose}
                onSubmit={async (data) => {
                    const saved = await onSave(data)
                    if (saved) onClose()
                }}
            />
        </Modal>
    )
}
