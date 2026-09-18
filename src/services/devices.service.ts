import { supabase } from '../lib/supabase';

export interface Device {
    id: string;
    school_id: string;
    name: string;
    active: boolean;
    last_seen_at: string | null;
    created_at: string;
    revoked_at: string | null;
}

export interface DeviceClaim {
    id: string;
    device_identifier: string;
    claimed_at: string;
}

const deviceFields = 'id,school_id,name,active,last_seen_at,created_at,revoked_at';

export const DeviceService = {
    getBySchool: async (schoolId: string): Promise<Device[]> => {
        const { data, error } = await supabase
            .from('devices')
            .select(deviceFields)
            .eq('school_id', schoolId)
            .order('name');

        if (error) throw new Error(error.message);
        return data || [];
    },

    create: async (schoolId: string, name: string): Promise<Device> => {
        const { data, error } = await supabase
            .from('devices')
            .insert({ school_id: schoolId, name })
            .select(deviceFields)
            .single();

        if (error) throw new Error(error.message);
        return data;
    },

    rename: async (id: string, name: string): Promise<Device> => {
        const { data, error } = await supabase
            .from('devices')
            .update({ name })
            .eq('id', id)
            .select(deviceFields)
            .single();

        if (error) throw new Error(error.message);
        return data;
    },

    revoke: async (id: string): Promise<Device> => {
        const { data, error } = await supabase
            .from('devices')
            .update({ active: false, revoked_at: new Date().toISOString() })
            .eq('id', id)
            .select(deviceFields)
            .single();

        if (error) throw new Error(error.message);
        return data;
    },

    remove: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('devices')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    },

    generateConfigCode: async (id: string): Promise<string> => {
        const { data, error } = await supabase.rpc('generate_device_config_code', { p_device_id: id });

        if (error) throw new Error(error.message);
        return data;
    },

    getClaims: async (deviceId: string): Promise<DeviceClaim[]> => {
        const { data, error } = await supabase.rpc('get_device_claims', { p_device_id: deviceId });

        if (error) throw new Error(error.message);
        return data || [];
    },
};
