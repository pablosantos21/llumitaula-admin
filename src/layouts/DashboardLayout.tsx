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
    Menu as MenuIcon,
    X,
    School as SchoolIcon,
    Loader2
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
    const [school, setSchool] = useState<School | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
        { name: 'Monitores', href: `/school/${schoolId}/monitors`, icon: Users },
        { name: 'Niños', href: `/school/${schoolId}/children`, icon: Baby },
        { name: 'Incidencias', href: `/school/${schoolId}/incidences`, icon: AlertTriangle },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-200 sticky top-0 h-screen">
                <div className="p-6 flex items-center gap-2 border-b border-gray-100">
                    <div className="bg-indigo-600 p-1.5 rounded-lg">
                        <SchoolIcon className="h-5 w-5 text-white" />
                    </div>
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Cargando...</span>
                        </div>
                    ) : (
                        <span className="font-bold text-gray-900 truncate">{school?.name || 'Colegio'}</span>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <Link
                        to="/select-school"
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors mb-6"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Volver al panel
                    </Link>

                    {isAdmin && navigation.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-indigo-50 text-indigo-700"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", isActive ? "text-indigo-600" : "text-gray-400")} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
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
                </div>
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
                        <Utensils className="h-6 w-6 text-indigo-600" />
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
                                        ? "bg-indigo-50 text-indigo-700"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", isActive ? "text-indigo-600" : "text-gray-400")} />
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
                    <button onClick={() => setIsMobileMenuOpen(true)}>
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

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
