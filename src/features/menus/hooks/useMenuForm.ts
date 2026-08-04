import { useState, useCallback } from 'react'
import { MenuService } from '@/services/menus.service'
import type { MenuType } from '@/mocks/menus'
import { formatDate } from '../utils/date-utils'
import type { MenuGroup } from '../types'

interface FormState {
    id: string;
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
    schoolIds: string[];
    allergens: string[];
}

const initialFormState: FormState = {
    id: '',
    first_course: '',
    second_course: '',
    side: '',
    salad: '',
    dessert: '',
    schoolIds: [],
    allergens: []
}

export const useMenuForm = (selectedDate: Date | null, onSaveSuccess: () => void) => {
    const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
    const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<MenuGroup | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Form state for Normal Menu
    const [formData, setFormData] = useState<FormState>(initialFormState)

    // Form state for Matrix (Special Menus)
    const [matrixData, setMatrixData] = useState<Record<string, any>>({})

    const openNormalMenuModal = useCallback((group?: MenuGroup) => {
        if (group) {
            setEditingGroup(group)
            setFormData({
                id: group.menu?.id || '',
                first_course: group.menu?.first_course || '',
                second_course: group.menu?.second_course || '',
                side: group.menu?.side || '',
                salad: group.menu?.salad || '',
                dessert: group.menu?.dessert || '',
                schoolIds: group.schoolIds || [],
                allergens: group.menu?.allergens || []
            })
        } else {
            setEditingGroup(null)
            setFormData(initialFormState)
        }
        setIsMenuModalOpen(true)
    }, [])

    const openMatrixModal = useCallback((group: MenuGroup) => {
        setEditingGroup(group)
        const initialMatrix: Record<string, any> = {}

        // Find all special types supported by any school in this group
        const supportedSpecialTypes = Array.from(new Set((group.schools as any[]).flatMap(s => s.supportedMenuTypes)))
            .filter(t => t !== 'normal') as MenuType[]

        supportedSpecialTypes.forEach(type => {
            const variant = (group as any).variations?.find((v: any) => v.type === type)?.menu
            initialMatrix[type] = {
                first_course: variant?.first_course || group.menu?.first_course || '',
                second_course: variant?.second_course || group.menu?.second_course || '',
                side: variant?.side || group.menu?.side || '',
                salad: variant?.salad || group.menu?.salad || '',
                dessert: variant?.dessert || group.menu?.dessert || ''
            }
        })
        setMatrixData(initialMatrix)
        setIsMatrixModalOpen(true)
    }, [])

    const updateMatrixField = useCallback((type: string, field: string, value: string) => {
        setMatrixData(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: value
            }
        }))
    }, [])

    const toggleSelection = useCallback((id: string, field: 'schoolIds' | 'allergens') => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].includes(id)
                ? prev[field].filter(item => item !== id)
                : [...prev[field], id]
        }))
    }, [])

    const handleSaveAssignment = async () => {
        if (!selectedDate) return;

        try {
            setIsSaving(true);
            const menuData = {
                id: formData.id || undefined,
                type: 'normal' as MenuType,
                first_course: formData.first_course,
                second_course: formData.second_course,
                side: formData.side,
                salad: formData.salad,
                dessert: formData.dessert,
            };

            const savedMenu = await MenuService.upsertMenu(menuData);

            await MenuService.assignMenuToSchools(
                savedMenu.id,
                formData.schoolIds,
                formatDate(selectedDate)
            );

            onSaveSuccess();
            setIsMenuModalOpen(false);
        } catch (err) {
            console.error('Error saving assignment:', err);
            alert('Error al guardar el menú');
        } finally {
            setIsSaving(false);
        }
    }

    const handleSaveMatrix = async () => {
        if (!selectedDate || !editingGroup) return;

        try {
            setIsSaving(true);
            const dateStr = formatDate(selectedDate);

            const savePromises = Object.entries(matrixData).map(async ([type, fields]) => {
                const hasContent = Object.values(fields).some(v => !!v);
                if (!hasContent) return;

                const menuData = {
                    type: type as MenuType,
                    ...fields as any,
                };

                const savedMenu = await MenuService.upsertMenu(menuData);

                await MenuService.assignMenuToSchools(
                    savedMenu.id,
                    editingGroup.schoolIds,
                    dateStr
                );
            });

            await Promise.all(savePromises);

            onSaveSuccess();
            setIsMatrixModalOpen(false);
        } catch (err) {
            console.error('Error saving matrix:', err);
            alert('Error al guardar los menús especiales');
        } finally {
            setIsSaving(false);
        }
    }

    return {
        isMenuModalOpen,
        setIsMenuModalOpen,
        isMatrixModalOpen,
        setIsMatrixModalOpen,
        editingGroup,
        isSaving,
        formData,
        setFormData,
        matrixData,
        openNormalMenuModal,
        openMatrixModal,
        updateMatrixField,
        toggleSelection,
        handleSaveAssignment,
        handleSaveMatrix
    }
}
