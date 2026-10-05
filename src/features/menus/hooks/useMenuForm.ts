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
    const [editingGroup, setEditingGroup] = useState<MenuGroup | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState<FormState>(initialFormState)

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

            await MenuService.saveMenuWithSchools(
                formData.id,
                menuData,
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

    return {
        isMenuModalOpen,
        setIsMenuModalOpen,
        editingGroup,
        isSaving,
        formData,
        setFormData,
        openNormalMenuModal,
        toggleSelection,
        handleSaveAssignment,
    }
}
