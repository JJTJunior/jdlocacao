import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

/**
 * Generic Supabase data hook.
 * Fetches all rows for the logged-in user from `tableName`,
 * and provides insert / update / remove helpers.
 */
export function useSupabaseTable<T extends { id: string }>(tableName: string, userId: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (!error && data) setRows(data as T[]);
    setLoading(false);
  }, [tableName, userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const insert = useCallback(async (item: Omit<T, 'id'> & Record<string, any>) => {
    const { data, error } = await supabase
      .from(tableName)
      .insert({ ...item, user_id: userId })
      .select()
      .single();
    if (!error && data) setRows(prev => [...prev, data as T]);
    return { data, error };
  }, [tableName, userId]);

  const update = useCallback(async (id: string, changes: Partial<T> & Record<string, any>) => {
    const { data, error } = await supabase
      .from(tableName)
      .update(changes)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (!error && data) setRows(prev => prev.map(r => r.id === id ? data as T : r));
    return { data, error };
  }, [tableName, userId]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (!error) setRows(prev => prev.filter(r => r.id !== id));
    return { error };
  }, [tableName, userId]);

  return { rows, setRows, loading, fetchAll, insert, update, remove };
}
