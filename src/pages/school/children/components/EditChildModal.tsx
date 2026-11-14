import { Modal } from "../../../../components/ui/modal"
import type { Child } from "../../../../services/children.service"
import type { Class } from "../../../../services/classes.service"
import type { Allergen } from "../../../../services/allergens.service"
import { ChildForm } from "./ChildForm"

interface EditChildModalProps {
    isOpen: boolean
    onClose: () => void
    child: Child | null
    classes: Class[]
    allergens: Allergen[]
    isLoading?: boolean
    onSave: (updatedChild: Child, allergenIds: string[], lunch_weekdays: number[] | null) => Promise<boolean>
}

export function EditChildModal({ isOpen, onClose, child, classes, allergens, isLoading, onSave }: EditChildModalProps) {
    if (!isOpen || !child) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Alumno" size="lg">
            <ChildForm
                key={child.id}
                initialData={{
                    first_name: child.first_name,
                    last_name: child.last_name,
                    class_id: child.class_id,
                    allergenIds: child.child_allergens?.map(a => a.allergen_id) || [],
                    lunch_weekdays: child.lunch_weekdays,
                }}
                classes={classes}
                allergens={allergens}
                isLoading={isLoading}
                submitLabel="Guardar Cambios"
                loadingLabel="Guardando..."
                onCancel={onClose}
                onSubmit={async (data) => {
                    const saved = await onSave(
                        {
                            ...child,
                            first_name: data.first_name,
                            last_name: data.last_name,
                            class_id: data.class_id,
                        },
                        data.allergenIds,
                        data.lunch_weekdays
                    )
                    if (saved) onClose()
                }}
            />
        </Modal>
    )
}
