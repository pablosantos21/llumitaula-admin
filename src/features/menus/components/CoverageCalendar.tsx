import { Calendar } from '@/components/ui/calendar'
import { Loader2, Check } from 'lucide-react'
import type { DayCoverageInfo } from '../types'

interface CoverageCalendarProps {
    isLoading: boolean;
    currentMonth: Date;
    onMonthChange: (date: Date) => void;
    selectedDate: Date | null;
    onDateClick: (date: Date) => void;
    getDayCoverage: (date: Date) => DayCoverageInfo;
}

export const CoverageCalendar = ({
    isLoading,
    currentMonth,
    onMonthChange,
    selectedDate,
    onDateClick,
    getDayCoverage
}: CoverageCalendarProps) => {

    const renderCalendarDay = (date: Date) => {
        const coverageInfo = getDayCoverage(date);
        if (!coverageInfo.isWorkingDay) return null;

        return (
            <div className="mt-1 flex flex-col items-center">
                {coverageInfo.isAll ? (
                    <div className="bg-emerald-100 rounded-full p-0.5">
                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                    </div>
                ) : coverageInfo.count > 0 ? (
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1 rounded border border-orange-100">
                            Parcial
                        </span>
                        <span className="text-[8px] text-orange-400 mt-0.5">
                            {coverageInfo.count}/{coverageInfo.total}
                        </span>
                    </div>
                ) : (
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full" title="Sin menús" />
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Estado de Cobertura</h2>
                    {isLoading && <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />}
                </div>
                <div className="flex gap-4 text-[10px] items-center">
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 bg-emerald-500 rounded-full" />
                        <span>Completo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 bg-amber-500 rounded-full" />
                        <span>Parcial</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 bg-red-500 rounded-full" />
                        <span>Sin Menú</span>
                    </div>
                </div>
            </div>
            <Calendar
                onDateClick={onDateClick}
                renderDay={renderCalendarDay}
                currentMonth={currentMonth}
                onMonthChange={onMonthChange}
                selectedDate={selectedDate}
            />
        </div>
    )
}
