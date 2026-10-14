import { Outlet, useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import {
    Utensils,
    Users,
    Baby,
    AlertTriangle,
    LogOut,
    ChevronLeft,
    PanelLeft,
    Menu as MenuIcon,
    X,
    School as SchoolIcon,
    Loader2,
    Smartphone
    , ClipboardCheck
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { SchoolService, type School } from '../services/schools.service';

export default function DashboardLayout() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const { user, logout, isAdmin } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            return localStorage.getItem('dashboard-sidebar-collapsed') === 'true';
        } catch {
            return false;
        }
    });
    const [school, setSchool] = useState<School | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            localStorage.setItem('dashboard-sidebar-collapsed', String(isCollapsed));
        } catch {
            // ignore storage errors (private mode, etc.)
        }
    }, [isCollapsed]);

    useEffect(() => {
        const fetchSchool = async () => {
            if (!schoolId) return;
            try {
                setIsLoading(true);
                const data = await SchoolService.getSchoolById(schoolId);
                setSchool(data);
            } catch (err) {
                console.error('Error fetching school:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchool();
    }, [schoolId]);

    const navigation = [
        { name: 'Trabajadores', href: `/school/${schoolId}/monitors`, icon: Users },
        { name: 'Niños', href: `/school/${schoolId}/children`, icon: Baby },
        { name: 'Incidencias', href: `/school/${schoolId}/incidences`, icon: AlertTriangle },
        { name: 'Aulas', href: `/school/${schoolId}/classes`, icon: SchoolIcon },
        { name: 'Dispositivos', href: `/school/${schoolId}/devices`, icon: Smartphone },
        { name: 'Asistencia', href: `/school/${schoolId}/attendance`, icon: ClipboardCheck },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsCollapsed((v) => !v);

    const activeItem = navigation.find((item) => location.pathname.startsWith(item.href));

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar Desktop — estilo shadcn (collapsible="icon") */}
            <aside className={cn(
                "hidden md:flex flex-col bg-white border-r border-gray-200 sticky top-0 h-screen transition-[width] duration-200 ease-linear group/sidebar relative shrink-0",
                isCollapsed ? "w-16" : "w-64"
            )}>
                {/* Cabecera del sidebar */}
                <div className={cn(
                    "flex h-16 items-center border-b border-gray-100 shrink-0",
                    isCollapsed ? "justify-center px-2" : "gap-2 px-4"
                )}>
                    <div className="bg-primary-600 p-1.5 rounded-lg shrink-0">
                        <SchoolIcon className="h-5 w-5 text-white" />
                    </div>
                    {!isCollapsed && (
                        isLoading ? (
                            <div className="flex items-center gap-2 text-gray-400 min-w-0">
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                <span className="text-xs">Cargando...</span>
                            </div>
                        ) : (
                            <span className="font-semibold text-gray-900 truncate" title={school?.name || 'Colegio'}>
                                {school?.name || 'Colegio'}
                            </span>
                        )
                    )}
                </div>

                <nav className={cn("flex-1 space-y-1 overflow-y-auto overflow-x-hidden", isCollapsed ? "p-2" : "p-4")}>
                    <Link
                        to="/select-school"
                        title={isCollapsed ? 'Volver al panel' : undefined}
                        className={cn(
                            "flex items-center text-sm font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors mb-6",
                            isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2"
                        )}
                    >
                        <ChevronLeft className="h-4 w-4 shrink-0" />
                        {!isCollapsed && 'Volver al panel'}
                    </Link>

                    {isAdmin && navigation.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                title={isCollapsed ? item.name : undefined}
                                className={cn(
                                    "flex items-center rounded-md text-sm font-medium transition-colors",
                                    isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2",
                                    isActive
                                        ? "bg-primary-50 text-primary-700"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-600" : "text-gray-400")} />
                                {!isCollapsed && item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className={cn("border-t border-gray-100 shrink-0", isCollapsed ? "p-2" : "p-4")}>
                    {!isCollapsed ? (
                        <>
                            <div className="flex items-center gap-3 px-3 py-2">
                                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                                    {user?.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full mt-2 justify-start text-gray-500 hover:text-red-600 hover:bg-red-50"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Cerrar sesión
                            </Button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div
                                className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs"
                                title={user?.name}
                            >
                                {user?.name.charAt(0)}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                title="Cerrar sesión"
                                aria-label="Cerrar sesión"
                                className="h-10 w-10 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Rail lateral estilo shadcn: clic en el borde para plegar/desplegar */}
                <button
                    type="button"
                    onClick={toggleSidebar}
                    title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                    aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
                    aria-expanded={!isCollapsed}
                    data-collapsed={isCollapsed}
                    className="absolute inset-y-0 -right-2 z-20 hidden w-4 md:flex cursor-ew-resize items-center justify-center group/rail"
                >
                    <span className="h-full w-0.5 bg-transparent transition-colors group-hover/rail:bg-gray-300" />
                </button>
            </aside>

            {/* Mobile Menu */}
            <div className={cn(
                "fixed inset-0 z-40 md:hidden bg-gray-600 bg-opacity-75 transition-opacity ease-linear duration-300",
                isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )} onClick={() => setIsMobileMenuOpen(false)} />

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition ease-in-out duration-300 md:hidden flex flex-col",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Utensils className="h-6 w-6 text-primary-600" />
                        <span className="font-bold text-gray-900">Admin</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)}>
                        <X className="h-6 w-6 text-gray-400" />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {/* Same nav links for mobile */}
                    {isAdmin && navigation.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary-50 text-primary-700"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", isActive ? "text-primary-600" : "text-gray-400")} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Abrir menú">
                        <MenuIcon className="h-6 w-6 text-gray-500" />
                    </button>
                    <span className="font-bold text-gray-900">
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        ) : (
                            school?.name || 'Colegio'
                        )}
                    </span>
                    <div className="w-6" /> {/* Placeholder for symmetry */}
                </header>

                {/* Desktop Header estilo shadcn: SidebarTrigger + separador + sección */}
                <header className="hidden md:flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                        aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
                        aria-expanded={!isCollapsed}
                        className="h-7 w-7 text-gray-500 hover:text-gray-900"
                    >
                        <PanelLeft className="h-4 w-4" />
                        <span className="sr-only">Toggle Sidebar</span>
                    </Button>
                    <div aria-hidden="true" className="h-4 w-px bg-gray-200" />
                    <span className="text-sm font-medium text-gray-700 truncate">
                        {activeItem?.name ?? (isLoading ? 'Cargando...' : (school?.name || 'Colegio'))}
                    </span>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
