import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

interface CalendarProps {
    onDateClick?: (date: Date) => void
    highlightedDates?: Set<string> // Format: YYYY-MM-DD
    renderDay?: (date: Date) => React.ReactNode
    currentMonth?: Date
    onMonthChange?: (date: Date) => void
    selectedDate?: Date | null
}

export function Calendar({ onDateClick, highlightedDates, renderDay, currentMonth: controlledMonth, onMonthChange, selectedDate }: CalendarProps) {
    const [internalMonth, setInternalMonth] = useState(new Date())
    const currentDate = controlledMonth || internalMonth

    const setCurrentDate = (date: Date) => {
        if (onMonthChange) {
            onMonthChange(date)
        } else {
            setInternalMonth(date)
        }
    }

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]

    const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

    const totalDays = daysInMonth(year, month)
    const firstDay = (firstDayOfMonth(year, month) + 6) % 7 // Adjust Sunday (0) to 6 and Monday (1) to 0

    const days = []
    for (let i = 0; i < firstDay; i++) {
        days.push(null)
    }
    for (let i = 1; i <= totalDays; i++) {
        days.push(new Date(year, month, i))
    }

    const formatDate = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    const isToday = (date: Date) => {
        const today = new Date()
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
    }

    const isSelected = (date: Date) => {
        if (!selectedDate) return false
        return date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear()
    }

    return (
        <div className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">
                    {monthNames[month]} {year}
                </h3>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="p-4">
                <div className="grid grid-cols-7 gap-px mb-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {dayNames.map(day => <div key={day} className="py-2">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {days.map((date, i) => (
                        <div key={i} className="aspect-square">
                            {date ? (
                                <button
                                    onClick={() => onDateClick?.(date)}
                                    className={cn(
                                        "w-full h-full rounded-lg flex flex-col items-center justify-center transition-all relative group p-1",
                                        isSelected(date)
                                            ? "bg-indigo-100 text-gray-700 shadow-md shadow-indigo-100"
                                            : "hover:bg-gray-50 text-gray-700",
                                        highlightedDates?.has(formatDate(date)) && !isSelected(date) && "font-bold text-indigo-600"
                                    )}
                                >
                                    <span className={cn("text-sm", isSelected(date) ? "font-bold" : "")}>{date.getDate()}</span>
                                    {renderDay && renderDay(date)}
                                    {!renderDay && highlightedDates?.has(formatDate(date)) && !isSelected(date) && (
                                        <div className="absolute bottom-2 w-1 h-1 bg-indigo-600 rounded-full" />
                                    )}
                                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-100 rounded-lg pointer-events-none" />
                                </button>
                            ) : (
                                <div className="w-full h-full" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
