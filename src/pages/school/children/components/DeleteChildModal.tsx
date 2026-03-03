import { Modal } from "../../../../components/ui/modal"
import { Button } from "../../../../components/ui/button"
import type { Child } from "../../../../services/children.service"

interface DeleteChildModalProps {
    isOpen: boolean
    onClose: () => void
    child: Child | null
    isLoading?: boolean
    onConfirm: (id: string) => void
}

export function DeleteChildModal({ isOpen, onClose, child, isLoading, onConfirm }: DeleteChildModalProps) {
    if (!child) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirmar Eliminación" size="md">
            <div className="space-y-6">
                <div className="text-center">
                    <p className="text-gray-600">
                        ¿Estás seguro de que deseas eliminar a <span className="font-bold text-gray-900">{child.first_name} {child.last_name}</span>?
                    </p>
                    <p className="text-sm text-red-600 mt-2">
                        Esta acción no se puede deshacer.
                    </p>
                </div>

                <div className="flex justify-center gap-3 pt-4 border-t border-gray-100">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                        onClick={() => onConfirm(child.id)}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Eliminando...' : 'Eliminar Alumno'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
