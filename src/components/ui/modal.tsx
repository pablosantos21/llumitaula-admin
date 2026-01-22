import * as React from "react"
import { X } from "lucide-react"
import { Button } from "./button"
import { cn } from "../../lib/utils"

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full'
}

export function Modal({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) {
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            window.addEventListener('keydown', handleEscape)
        }
        return () => {
            document.body.style.overflow = 'unset'
            window.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '4xl': 'max-w-4xl',
        '6xl': 'max-w-6xl',
        full: 'max-w-[95vw]'
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            <div className={cn("relative w-full transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all", sizeClasses[size])}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-400">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="px-6 py-6 overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    )
}
