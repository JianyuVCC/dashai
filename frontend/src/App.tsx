import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from './components/AuthGuard'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { AppHome } from './pages/AppHome'
import { DataPage } from './pages/DataPage'
import { DashboardPage } from './pages/DashboardPage'
import { PublicDashboardPage } from './pages/PublicDashboardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Public dashboard view */}
      <Route path="/p/:slug" element={<PublicDashboardPage />} />

      {/* Protected app routes */}
      <Route
        path="/app"
        element={
          <AuthGuard>
            <AppHome />
          </AuthGuard>
        }
      />
      <Route
        path="/app/data"
        element={
          <AuthGuard>
            <DataPage />
          </AuthGuard>
        }
      />
      <Route
        path="/app/dashboard/:id"
        element={
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
