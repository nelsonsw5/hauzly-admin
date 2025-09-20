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
import Purchase from './Purchase.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <SignUp /> },
      { path: 'privacy', element: <PrivacyPolicy /> },
      { path: 'terms', element: <Terms /> },
      { path: 'dashboard', element: (
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      ) },
      { path: 'returns', element: (
        <ProtectedRoute>
          <Returns />
        </ProtectedRoute>
      ) },
      { path: 'users', element: (
        <AdminRoute>
          <Users />
        </AdminRoute>
      ) },
      { path: 'purchase', element: <Purchase /> },
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