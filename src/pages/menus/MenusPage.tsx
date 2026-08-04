import { useState } from 'react'
import {
    useMenusData,
    useMenuForm,
    MenuHeader,
    CoverageCalendar,
    DailyProgramming,
    NormalMenuModal,
    SpecialMenusView
} from '@/features/menus'

type MenuTab = 'menus' | 'especiales'

export default function MenusPage() {
    const [activeTab, setActiveTab] = useState<MenuTab>('menus')

    const {
        selectedDate,
        setSelectedDate,
        currentMonth,
        setCurrentMonth,
        schools,
        groupedMenus,
        assignedSchoolIds,
        unassignedSchoolsCount,
        isLoadingCoverage,
        isLoadingDaily,
        getDayCoverage,
        refreshData
    } = useMenusData()

    const {
        isMenuModalOpen,
        setIsMenuModalOpen,
        editingGroup,
        isSaving,
        formData,
        setFormData,
        openNormalMenuModal,
        toggleSelection,
        handleSaveAssignment,
    } = useMenuForm(selectedDate, refreshData)

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <MenuHeader activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                {activeTab === 'menus' ? (
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Gestión de Menús</h1>
                                <p className="text-sm text-gray-500">Consulta la cobertura de menús por día y colegio.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <CoverageCalendar
                                isLoading={isLoadingCoverage}
                                currentMonth={currentMonth}
                                onMonthChange={setCurrentMonth}
                                selectedDate={selectedDate}
                                onDateClick={setSelectedDate}
                                getDayCoverage={getDayCoverage}
                            />

                            <DailyProgramming
                                selectedDate={selectedDate}
                                isLoading={isLoadingDaily}
                                groupedMenus={groupedMenus}
                                unassignedSchoolsCount={unassignedSchoolsCount}
                                openNormalMenuModal={openNormalMenuModal}
                            />
                        </div>

                        <NormalMenuModal
                            isOpen={isMenuModalOpen}
                            onClose={() => setIsMenuModalOpen(false)}
                            editingGroup={editingGroup}
                            formData={formData}
                            setFormData={setFormData}
                            schools={schools}
                            assignedSchoolIds={assignedSchoolIds}
                            toggleSelection={toggleSelection}
                            onSave={handleSaveAssignment}
                            isSaving={isSaving}
                        />
                    </>
                ) : (
                    <SpecialMenusView />
                )}
            </main>
        </div>
    )
}
