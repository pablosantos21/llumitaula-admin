export interface AttendanceDisplayNames {
    child_first_name?: string;
    child_last_name?: string;
    class_name?: string;
    confirmer_name?: string | null;
}

export interface DailyAttendanceRow extends AttendanceDisplayNames {
    child_id: string;
    class_id: string;
    school_id: string;
    attendance_date: string;
    present: boolean;
    confirmed_by: string;
    confirmed_at: string;
}

export type DailyAttendanceStatus = 'never-passed' | 'confirmed-empty' | 'confirmed';

export interface DailyAttendanceSummary {
    status: DailyAttendanceStatus;
    total: number;
    presentCount: number;
    absentCount: number;
}

export interface AttendanceConfirmationMeta {
    confirmedBy: string;
    confirmerName: string | null;
    confirmedAt: string;
}

export function summarizeDailyAttendance(rows: readonly DailyAttendanceRow[]): DailyAttendanceSummary {
    if (rows.length === 0) {
        return { status: 'never-passed', total: 0, presentCount: 0, absentCount: 0 };
    }
    const presentCount = rows.filter(row => row.present).length;
    return {
        status: presentCount === 0 ? 'confirmed-empty' : 'confirmed',
        total: rows.length,
        presentCount,
        absentCount: rows.length - presentCount,
    };
}

export function filterPresentChildIds(rows: readonly DailyAttendanceRow[]): string[] {
    return rows.filter(row => row.present).map(row => row.child_id);
}

export function getConfirmationMeta(rows: readonly DailyAttendanceRow[]): AttendanceConfirmationMeta | null {
    if (rows.length === 0) return null;
    let latest = rows[0];
    for (const row of rows) {
        if (row.confirmed_at > latest.confirmed_at) latest = row;
    }
    return {
        confirmedBy: latest.confirmed_by,
        confirmerName: latest.confirmer_name ?? null,
        confirmedAt: latest.confirmed_at,
    };
}
