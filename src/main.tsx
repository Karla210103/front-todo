import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import TaskDetail from "./pages/TaskDetail";
import ProtectedRoute from "./routes/ProtectedRoute";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
    <Routes>
      {/* Rutas publicas */}
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Rutas protegidas */}
      <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
          </ProtectedRoute>
      }
      />
      <Route
      path="/tasks/:id"
      element={
        <ProtectedRoute>
          <TaskDetail />
        </ProtectedRoute>
      }
      />

      {/* Redireccionar cualquier ruta no definida o login*/}
        <Route path= "*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);