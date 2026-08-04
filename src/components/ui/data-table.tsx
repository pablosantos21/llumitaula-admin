import { cn } from "../../lib/utils"

interface DataTableProps<T> {
    columns: {
        header: string
        accessor: ((item: T) => React.ReactNode)
        className?: string
    }[]
    data: T[]
    onRowClick?: (item: T) => void
    emptyMessage?: string
}

export function DataTable<T>({ columns, data, onRowClick, emptyMessage = "No hay datos disponibles." }: DataTableProps<T>) {
    return (
        <div className="w-full overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold tracking-wider">
                    <tr>
                        {columns.map((column, i) => (
                            <th key={i} className={cn("px-6 py-4 border-b border-gray-200", column.className)}>
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length > 0 ? (
                        data.map((item, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={cn(
                                    "hover:bg-gray-50 transition-colors bg-white",
                                    onRowClick && "cursor-pointer"
                                )}
                                onClick={() => onRowClick?.(item)}
                            >
                                {columns.map((column, colIndex) => (
                                    <td key={colIndex} className={cn("px-6 py-4 text-gray-600", column.className)}>
                                        {column.accessor(item)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 italic bg-white">
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
