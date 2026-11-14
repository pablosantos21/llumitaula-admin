export type UserRole = 'admin' | 'supervisor' | 'monitor';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

export interface SupabaseUserLike {
    id: string;
    email?: string;
    app_metadata?: {
        provider?: string;
        role?: unknown;
        [key: string]: unknown;
    };
}

export const normalizeRole = (role: unknown): UserRole => {
    if (role === 'admin' || role === 'supervisor' || role === 'monitor') {
        return role;
    }

    return 'monitor';
};

export const mapSupabaseUser = (user: SupabaseUserLike | null | undefined): User | null => {
    if (!user) return null;
    return {
        id: user.id,
        name: user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: normalizeRole(user.app_metadata?.role),
    };
};

const getSupabase = async () => {
    const { supabase } = await import('../lib/supabase.ts');
    return supabase;
};

export const AuthService = {
    login: async (email: string, password: string): Promise<User> => {
        const supabase = await getSupabase();
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

        const mapped = mapSupabaseUser(data.user);
        if (!mapped) {
            throw new Error('Login failed: No user returned');
        }
        return mapped;
    },

    logout: async () => {
        const supabase = await getSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw new Error(error.message);
        }
    },

    getCurrentUser: async (): Promise<User | null> => {
        const supabase = await getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        return mapSupabaseUser(user);
    },

    onAuthStateChange: (callback: (user: User | null) => void) => {
        let subscription: { unsubscribe: () => void } | null = null;
        let isUnsubscribed = false;

        void getSupabase().then(supabase => {
            if (isUnsubscribed) return;
            const res = supabase.auth.onAuthStateChange((_event, session) => {
                callback(mapSupabaseUser(session?.user));
            });
            subscription = res.data.subscription;
        });

        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        isUnsubscribed = true;
                        subscription?.unsubscribe();
                    }
                }
            }
        };
    }
};
