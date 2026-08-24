import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'supervisor' | 'monitor';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

const normalizeRole = (role: unknown): UserRole => {
    if (role === 'admin' || role === 'supervisor' || role === 'monitor') {
        return role;
    }

    return 'monitor';
};

export const AuthService = {
    login: async (email: string, password: string): Promise<User> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw new Error(error.message);
        }

        if (!data.user) {
            throw new Error('Login failed: No user returned');
        }

        // Map Supabase user to our User interface
        // Read the role from trusted app metadata or default to monitor
        return {
            id: data.user.id,
            name: data.user.email?.split('@')[0] || 'User',
            email: data.user.email || '',
            role: normalizeRole(data.user.app_metadata?.role),
        };
    },

    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw new Error(error.message);
        }
    },

    getCurrentUser: async (): Promise<User | null> => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        return {
            id: user.id,
            name: user.email?.split('@')[0] || 'User',
            email: user.email || '',
            role: normalizeRole(user.app_metadata?.role),
        };
    },

    onAuthStateChange: (callback: (user: User | null) => void) => {
        return supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                callback({
                    id: session.user.id,
                    name: session.user.email?.split('@')[0] || 'User',
                    email: session.user.email || '',
                    role: normalizeRole(session.user.app_metadata?.role),
                });
            } else {
                callback(null);
            }
        });
    }
};
