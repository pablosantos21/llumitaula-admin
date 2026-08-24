import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/login/LoginPage'
import SelectSchoolPage from './pages/select-school/SelectSchoolPage'
import DashboardLayout from './layouts/DashboardLayout'
import MenusPage from './pages/menus/MenusPage'
import SpecialMenuPage from './pages/menus/SpecialMenuPage'
import MonitorsPage from './pages/school/monitors/MonitorsPage'
import ChildrenPage from './pages/school/children/ChildrenPage'
import IncidentsPage from './pages/school/incidents/IncidentsPage'

// Protected Route Wrapper
function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function AdminRoute() {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return <Navigate to="/select-school" replace />
  }

  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/select-school" replace />} />
            <Route path="/select-school" element={<SelectSchoolPage />} />
            <Route path="/menus" element={<MenusPage />} />

            <Route element={<AdminRoute />}>
              <Route path="/menus/:menuId" element={<SpecialMenuPage />} />

              <Route path="/school/:schoolId" element={<DashboardLayout />}>
                <Route index element={<Navigate to="monitors" replace />} />
                <Route path="monitors" element={<MonitorsPage />} />
                <Route path="children" element={<ChildrenPage />} />
                <Route path="incidences" element={<IncidentsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
