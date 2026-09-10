import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import Layout from "./components/Layout.js";
import Login from "./pages/Login.js";
import Dashboard from "./pages/Dashboard.js";
import ProgramsList from "./pages/ProgramsList.js";
import ProgramEditor from "./pages/ProgramEditor.js";
import ActiveWorkout from "./pages/ActiveWorkout.js";
import WorkoutHistory from "./pages/WorkoutHistory.js";
import FoodLog from "./pages/FoodLog.js";
import Goals from "./pages/Goals.js";
import Recipes from "./pages/Recipes.js";
import Coach from "./pages/Coach.js";
import SettingsPage from "./pages/Settings.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  if (authenticated === null) return <div className="p-6 text-center text-gray-400">Laden...</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="train" element={<ProgramsList />} />
                <Route path="train/programs/:id" element={<ProgramEditor />} />
                <Route path="train/session/:id" element={<ActiveWorkout />} />
                <Route path="train/history" element={<WorkoutHistory />} />
                <Route path="eat" element={<FoodLog />} />
                <Route path="eat/goals" element={<Goals />} />
                <Route path="eat/recipes" element={<Recipes />} />
                <Route path="coach" element={<Coach />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
