import { SnackbarProvider } from "zmp-ui";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import HomePage from "@/pages/index";
import TabBar from "./taskbar";
import AccountPage from "@/pages/account";
import PlayingPage from "@/pages/playing";
import TablesPage from "@/pages/tables";
import LoginPage from "@/pages/login";
import WalletPage from "@/pages/wallet";
import AdminWalletsPage from "@/pages/admin-wallets";
import AdminRegistrationPage from "@/pages/admin-registration";
import AdminProductsPage from "@/pages/admin-products";
import XuPage from "@/pages/xu";
import AdminXuPage from "@/pages/admin-xu";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TablesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route path="/account/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/account/xu" element={<ProtectedRoute><XuPage /></ProtectedRoute>} />
        <Route path="/admin/wallets" element={<ProtectedRoute><AdminWalletsPage /></ProtectedRoute>} />
        <Route path="/admin/xu" element={<ProtectedRoute><AdminXuPage /></ProtectedRoute>} />
        <Route path="/admin/registration" element={<ProtectedRoute><AdminRegistrationPage /></ProtectedRoute>} />
        <Route path="/admin/products" element={<ProtectedRoute><AdminProductsPage /></ProtectedRoute>} />
        <Route
          path="/bills/:billId"
          element={
            <ProtectedRoute>
              <PlayingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:tableId"
          element={
            <ProtectedRoute>
              <PlayingPage />
            </ProtectedRoute>
          }
        />
      </Routes>
      <TabBar />
    </>
  );
}

const Layout = () => {
  return (
    <BrowserRouter>
      <SnackbarProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </SnackbarProvider>
    </BrowserRouter>
  );
};
export default Layout;
