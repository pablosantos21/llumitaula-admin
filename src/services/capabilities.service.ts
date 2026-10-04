import { supabase } from '../lib/supabase'

export const CAPABILITY_OPTIONS = [
    {
        key: 'family_meal_records',
        label: 'Registros de comidas para familias',
        description: 'Permite a las familias consultar los registros de comidas de sus hijos.',
    },
    {
        key: 'monitor_internal_notifications',
        label: 'Publicación de notificaciones internas',
        description: 'Permite a los monitores publicar nuevas notificaciones internas.',
    },
    {
        key: 'monitor_daily_summary',
        label: 'Resumen diario de monitores',
        description: 'Permite a los monitores consultar el resumen diario.',
    },
] as const

export type CapabilityKey = (typeof CAPABILITY_OPTIONS)[number]['key']
export type CapabilitySource = 'class' | 'school' | 'default'

export interface CapabilitySetting {
    class_id: string | null
    capability: CapabilityKey
    school_value: boolean
    override_value: boolean | null
    enabled: boolean
    source: CapabilitySource
}

export interface EffectiveCapability {
    capability: CapabilityKey
    enabled: boolean
}

export const CapabilityService = {
    getSettings: async (schoolId: string): Promise<CapabilitySetting[]> => {
        const { data, error } = await supabase.rpc('get_capability_settings', {
            p_school_id: schoolId,
        })

        if (error) throw error
        return (data ?? []) as CapabilitySetting[]
    },

    getEffectiveForClass: async (classId: string): Promise<EffectiveCapability[]> => {
        const { data, error } = await supabase.rpc('get_effective_capabilities', {
            p_class_id: classId,
            p_child_id: null,
        })

        if (error) throw error
        return (data ?? []) as EffectiveCapability[]
    },

    getEffectiveForChild: async (childId: string): Promise<EffectiveCapability[]> => {
        const { data, error } = await supabase.rpc('get_effective_capabilities', {
            p_class_id: null,
            p_child_id: childId,
        })

        if (error) throw error
        return (data ?? []) as EffectiveCapability[]
    },

    setSchoolCapability: async (schoolId: string, capability: CapabilityKey, enabled: boolean): Promise<void> => {
        const { error } = await supabase.rpc('set_school_capability', {
            p_school_id: schoolId,
            p_capability: capability,
            p_enabled: enabled,
        })

        if (error) throw error
    },

    setClassCapability: async (classId: string, capability: CapabilityKey, enabled: boolean): Promise<void> => {
        const { error } = await supabase.rpc('set_class_capability', {
            p_class_id: classId,
            p_capability: capability,
            p_enabled: enabled,
        })

        if (error) throw error
    },

    resetClassCapability: async (classId: string, capability: CapabilityKey): Promise<void> => {
        const { error } = await supabase.rpc('reset_class_capability', {
            p_class_id: classId,
            p_capability: capability,
        })

        if (error) throw error
    },
}
