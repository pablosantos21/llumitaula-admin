import { supabase } from '../lib/supabase';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'monitor';
}

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
        // We assume the role is stored in user metadata or we default to admin for now
        return {
            id: data.user.id,
            name: data.user.email?.split('@')[0] || 'User',
            email: data.user.email || '',
            role: (data.user.user_metadata?.role as 'admin' | 'monitor') || 'admin',
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
            role: (user.user_metadata?.role as 'admin' | 'monitor') || 'admin',
        };
    },

    onAuthStateChange: (callback: (user: User | null) => void) => {
        return supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                callback({
                    id: session.user.id,
                    name: session.user.email?.split('@')[0] || 'User',
                    email: session.user.email || '',
                    role: (session.user.user_metadata?.role as 'admin' | 'monitor') || 'admin',
                });
            } else {
                callback(null);
            }
        });
    }
};
