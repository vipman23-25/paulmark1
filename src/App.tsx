import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import EmployeePanel from "./pages/EmployeePanel";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import PersonnelManagement from "./pages/admin/PersonnelManagement";
import BreakTracking from "./pages/admin/BreakTracking";
import MovementManagement from "./pages/admin/MovementManagement";
import DayOffView from "./pages/admin/DayOffView";
import OvertimeManagement from "./pages/admin/OvertimeManagement";
import ReminderManagement from "./pages/admin/ReminderManagement";
import SystemSettingsView from "./pages/admin/SystemSettings";
import SalesTargets from "./pages/admin/SalesTargets";
import CargoManagement from "./pages/admin/CargoManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/employee" element={<EmployeePanel />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="personnel" element={<PersonnelManagement />} />
              <Route path="breaks" element={<BreakTracking />} />
              <Route path="movements" element={<MovementManagement />} />
              <Route path="day-off" element={<DayOffView />} />
              <Route path="overtime" element={<OvertimeManagement />} />
              <Route path="cargo" element={<CargoManagement />} />
              <Route path="reminders" element={<ReminderManagement />} />
              <Route path="sales-targets" element={<SalesTargets />} />
              <Route path="settings" element={<SystemSettingsView />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
