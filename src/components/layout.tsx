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
import AdminWalletTopupsPage from "@/pages/admin-wallet-topups";
import AdminRegistrationPage from "@/pages/admin-registration";
import AdminProductsPage from "@/pages/admin-products";
import AdminBillHistoryPage from "@/pages/admin-bill-history";
import AdminReportsPage from "@/pages/admin-reports";
import XuPage from "@/pages/xu";
import AdminXuPage from "@/pages/admin-xu";
import AdminPromotionsPage from "@/pages/admin-promotions";
import AdminCustomerSegmentsPage from "@/pages/admin-customer-segments";
import AdminDashboardPage from "@/pages/admin-dashboard";
import AdminInventoryPage from "@/pages/admin-inventory";
import AdminSettingsPage from "@/pages/admin-settings";
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
        <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/admin/inventory" element={<ProtectedRoute><AdminInventoryPage /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/wallets" element={<ProtectedRoute><AdminWalletsPage /></ProtectedRoute>} />
        <Route path="/admin/wallet-topups" element={<ProtectedRoute><AdminWalletTopupsPage /></ProtectedRoute>} />
        <Route path="/admin/xu" element={<ProtectedRoute><AdminXuPage /></ProtectedRoute>} />
        <Route path="/admin/registration" element={<ProtectedRoute><AdminRegistrationPage /></ProtectedRoute>} />
        <Route path="/admin/products" element={<ProtectedRoute><AdminProductsPage /></ProtectedRoute>} />
        <Route path="/admin/bill-history" element={<ProtectedRoute><AdminBillHistoryPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute><AdminReportsPage /></ProtectedRoute>} />
        <Route path="/admin/promotions" element={<ProtectedRoute><AdminPromotionsPage /></ProtectedRoute>} />
        <Route path="/admin/customer-segments" element={<ProtectedRoute><AdminCustomerSegmentsPage /></ProtectedRoute>} />
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
