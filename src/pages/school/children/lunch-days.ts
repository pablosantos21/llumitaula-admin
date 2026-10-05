export interface LunchWeekdayOption {
    value: number
    short: string
    name: string
}

export const LUNCH_WEEKDAYS: LunchWeekdayOption[] = [
    { value: 1, short: 'L', name: 'Lunes' },
    { value: 2, short: 'M', name: 'Martes' },
    { value: 3, short: 'X', name: 'Miércoles' },
    { value: 4, short: 'J', name: 'Jueves' },
    { value: 5, short: 'V', name: 'Viernes' },
]

export interface LunchDaysSummary {
    label: string
    className: string
}

export function summarizeLunchWeekdays(days: number[] | null): LunchDaysSummary {
    if (days === null) {
        return {
            label: 'Sin configurar',
            className: 'bg-white text-gray-400 border border-dashed border-gray-300',
        }
    }

    if (days.length === 0) {
        return {
            label: 'Sin días habituales',
            className: 'bg-gray-100 text-gray-600',
        }
    }

    return {
        label: LUNCH_WEEKDAYS
            .filter(day => days.includes(day.value))
            .map(day => day.short)
            .join(', '),
            className: 'bg-primary-50 text-primary-700',
    }
}
