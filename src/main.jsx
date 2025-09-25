import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import PrivacyPolicy from './PrivacyPolicy.jsx'
import Terms from './Terms.jsx'
import Login from './Login.jsx'
import SignUp from './SignUp.jsx'
import Dashboard from './Dashboard.jsx'
import { AuthProvider, ProtectedRoute, AdminRoute } from './AuthContext.jsx'
import Returns from './Returns.jsx'
import Users from './Users.jsx'
import Download from './Download.jsx'
import SuccessPage from './SuccessPage.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <SignUp /> },
      { path: 'success', element: <SuccessPage /> },
      { path: 'privacy', element: <PrivacyPolicy /> },
      { path: 'terms', element: <Terms /> },
      { path: 'download', element: <Download /> },
      { path: 'dashboard', element: (
        <AdminRoute>
          <Dashboard />
        </AdminRoute>
      ) },
      { path: 'returns', element: (
        <AdminRoute>
          <Returns />
        </AdminRoute>
      ) },
      { path: 'users', element: (
        <AdminRoute>
          <Users />
        </AdminRoute>
      ) },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
)