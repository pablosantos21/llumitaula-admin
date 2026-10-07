import { supabase } from '../lib/supabase';
import type { DailyAttendanceRow } from '../lib/attendance';

export type AttendanceFilters = {
    date?: string;
    classId?: string;
};

export interface AttendanceRecord extends DailyAttendanceRow {
    child_first_name: string;
    child_last_name: string;
    class_name: string;
    confirmer_name: string | null;
}

type AttendanceBaseRow = Omit<DailyAttendanceRow, 'child_first_name' | 'child_last_name' | 'class_name' | 'confirmer_name'>;

export const AttendanceService = {
    getBySchool: async (schoolId: string, filters: AttendanceFilters = {}): Promise<AttendanceRecord[]> => {
        let query = supabase
            .from('daily_attendance')
            .select('child_id,class_id,school_id,attendance_date,present,confirmed_by,confirmed_at')
            .eq('school_id', schoolId)
            .order('attendance_date', { ascending: false });

        if (filters.date) query = query.eq('attendance_date', filters.date);
        if (filters.classId) query = query.eq('class_id', filters.classId);

        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        const unattributedRows = (rows as unknown as AttendanceBaseRow[]) || [];
        if (unattributedRows.length === 0) return [];

        const childIds = [...new Set(unattributedRows.map(row => row.child_id))];
        const classIds = [...new Set(unattributedRows.map(row => row.class_id))];
        const confirmerIds = [...new Set(unattributedRows.map(row => row.confirmed_by))];

        const [childrenResult, classesResult, usersResult] = await Promise.all([
            supabase.from('children').select('id,first_name,last_name').in('id', childIds),
            supabase.from('classes').select('id,name').in('id', classIds),
            supabase.from('users').select('id,full_name').in('id', confirmerIds),
        ]);

        if (childrenResult.error) throw new Error(childrenResult.error.message);
        if (classesResult.error) throw new Error(classesResult.error.message);
        if (usersResult.error) throw new Error(usersResult.error.message);

        const childNameById = new Map<string, { first_name: string; last_name: string }>(
            ((childrenResult.data as unknown as { id: string; first_name: string; last_name: string }[]) || []).map(child => [
                child.id,
                { first_name: child.first_name, last_name: child.last_name },
            ]),
        );
        const classNameById = new Map<string, string>(
            ((classesResult.data as unknown as { id: string; name: string }[]) || []).map(item => [item.id, item.name]),
        );
        const confirmerNameById = new Map<string, string>(
            ((usersResult.data as unknown as { id: string; full_name: string }[]) || []).map(user => [user.id, user.full_name]),
        );

        return unattributedRows.map(row => ({
            ...row,
            child_first_name: childNameById.get(row.child_id)?.first_name ?? '',
            child_last_name: childNameById.get(row.child_id)?.last_name ?? '',
            class_name: classNameById.get(row.class_id) ?? '',
            confirmer_name: confirmerNameById.get(row.confirmed_by) ?? null,
        }));
    },
};
