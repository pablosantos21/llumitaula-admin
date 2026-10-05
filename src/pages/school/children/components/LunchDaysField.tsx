import { useId } from "react"
import { Label } from "../../../../components/ui/label"
import { LUNCH_WEEKDAYS } from "../lunch-days"

interface LunchDaysFieldProps {
    value: number[] | null
    onChange: (value: number[] | null) => void
}

const pillClass = (active: boolean) => `inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
    active
        ? 'bg-primary-50 text-primary-700 border-primary-300'
        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
}`

export function LunchDaysField({ value, onChange }: LunchDaysFieldProps) {
    const modeName = useId()
    const configured = value !== null
    const days = value ?? []

    const toggleDay = (dayValue: number) => {
        onChange(
            days.includes(dayValue)
                ? days.filter(day => day !== dayValue)
                : [...days, dayValue]
        )
    }

    return (
        <div className="space-y-2">
            <Label>Días habituales de comedor</Label>
            <div className="flex flex-wrap gap-2">
                <label className={pillClass(!configured)}>
                    <input
                        type="radio"
                        name={modeName}
                        className="sr-only"
                        checked={!configured}
                        onChange={() => onChange(null)}
                    />
                    Sin configurar
                </label>
                <label className={pillClass(configured)}>
                    <input
                        type="radio"
                        name={modeName}
                        className="sr-only"
                        checked={configured}
                        onChange={() => onChange(days)}
                    />
                    Configurar días
                </label>
            </div>

            {configured && (
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        {LUNCH_WEEKDAYS.map(day => (
                            <label
                                key={day.value}
                                className={pillClass(days.includes(day.value))}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={days.includes(day.value)}
                                    onChange={() => toggleDay(day.value)}
                                />
                                {day.name}
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500">
                        Selecciona los días laborables en los que el alumno suele comer.
                        Guardar sin días marcados indica que no come ningún día; “Sin
                        configurar” deja la pauta pendiente de definir.
                    </p>
                </div>
            )}
        </div>
    )
}
