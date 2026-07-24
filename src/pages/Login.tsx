import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import logo from '../assets/logo.png';
import "./Auth.css";

export default function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", data.name || (data.user && data.user.name) || "Usuario");

      setAuth(data.token);

      nav("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Error al iniciar sesión"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">

        <div className="auth-brand">
          <div className="auth-badge">
            <img src={logo} alt="Logo" className="auth-logo-img" />
          </div>
          <h2>App para tareas kawaii</h2>
          <p className="auth-muted">
            Organiza tus tareas de manera eficiente y kawaii
          </p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>

          <label>Correo electrónico</label>

          <input
            type="email"
            placeholder="Ingresa tu correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Contraseña</label>

          <div className="auth-pass">
            <input
              type={show ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className="auth-ghost"
              onClick={() => setShow((s) => !s)}
              aria-label="Mostrar/ocultar contraseña"
            >
              {show ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {error && <div className="auth-alert">{error}</div>}

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
          >
            {loading
              ? "Iniciando sesión..."
              : "Iniciar sesión"}
          </button>

        </form>

        <div className="auth-footer-links">
          <span className="auth-muted">
            ¿No tienes una cuenta?
          </span>

          <Link to="/register" className="auth-link">
            Regístrate aquí
          </Link>
        </div>

      </div>
    </div>
  );
}