
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    updateProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<{ error: any }>;
    deleteAccount: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        };

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) console.error("Error signing in with Google:", error.message);
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Error signing out:", error.message);
    };
    
    const updateProfile = async (updates: { full_name?: string; avatar_url?: string }) => {
        const { data, error } = await supabase.auth.updateUser({
            data: updates
        });
        if (data.user) {
            setUser(data.user);
        }
        return { error };
    };

    const deleteAccount = async () => {
        // Warning: This only works if enabled in Supabase or implemented via an Edge Function for security in some setups.
        // For standard client-side deletion, usually requires admin rights or specific RLS policies.
        // However, we can simulate the request. If it fails due to permissions, the user needs an Admin to delete it.
        // A common pattern for "Delete Self" is actually handled via a Remote Procedure Call (RPC) or Server Function.
        // We will try the standard call available to authenticated users if configured.
        
        // Note: supabase-js client doesn't expose deleteUser() for self directly without service key usually.
        // We will assume for this MVP that the user is instructing the Admin. 
        // BUT, we can delete the user's data. 
        
        // Proper way in Client SDK (if allowed by Supabase Config): 
        // Actually, strictly speaking, a user cannot delete themselves via the client SDK createClient() directly in most default configs.
        // For this demo, we will sign them out and pretend, or call an RPC if we had one.
        // Let's just sign out for safety and alert them.
        
        alert("Para excluir sua conta permanentemente, entre em contato com o administrador do sistema. Você será desconectado.");
        return await signOut();
    };

    const value = {
        user,
        session,
        loading,
        signInWithGoogle,
        signOut,
        updateProfile,
        deleteAccount
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
