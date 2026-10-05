import { Label } from "../../../../components/ui/label"
import { LUNCH_WEEKDAYS } from "../lunch-days"

export interface LunchDaysValue {
    configured: boolean
    days: number[]
}

interface LunchDaysFieldProps {
    idPrefix: string
    value: LunchDaysValue
    onChange: (value: LunchDaysValue) => void
}

export function LunchDaysField({ idPrefix, value, onChange }: LunchDaysFieldProps) {
    const toggleDay = (dayValue: number) => {
        onChange({
            ...value,
            days: value.days.includes(dayValue)
                ? value.days.filter(day => day !== dayValue)
                : [...value.days, dayValue],
        })
    }

    return (
        <div className="space-y-2">
            <Label>Días habituales de comedor</Label>
            <div className="flex flex-wrap gap-2">
                <label
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                        !value.configured
                            ? 'bg-primary-50 text-primary-700 border-primary-300'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                    <input
                        type="radio"
                        name={`${idPrefix}-lunch-mode`}
                        className="sr-only"
                        checked={!value.configured}
                        onChange={() => onChange({ ...value, configured: false })}
                    />
                    Sin configurar
                </label>
                <label
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                        value.configured
                            ? 'bg-primary-50 text-primary-700 border-primary-300'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                    <input
                        type="radio"
                        name={`${idPrefix}-lunch-mode`}
                        className="sr-only"
                        checked={value.configured}
                        onChange={() => onChange({ ...value, configured: true })}
                    />
                    Configurar días
                </label>
            </div>

            {value.configured && (
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        {LUNCH_WEEKDAYS.map(day => (
                            <label
                                key={day.value}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                                    value.days.includes(day.value)
                                        ? 'bg-primary-50 text-primary-700 border-primary-300'
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={value.days.includes(day.value)}
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
