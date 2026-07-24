import {useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {api, setAuth} from '../api';
import logo from '../assets/logo.png';
import "./Auth.css";


export default function Register() {
    const nav = useNavigate();
    const [name , setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(""); setLoading(true);
        try{
            const {data} = await api.post("/auth/register", {name, email, password});
            localStorage.setItem("token", data.token);
            setAuth(data.token);
            nav("/dashboard");
        }catch (err: any) {
            setError(err.response?.data?.message || "Error al registrarte papi intentalo de nuevo");
        }finally {
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
                    <h2>Crear Cuenta</h2>
                    <p className="auth-muted">Únete a nuestra comunidad</p>
                </div>
                <form className="auth-form" onSubmit={onSubmit}>
                    <label>Nombre completo</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ingresa tu nombre"
                        required
                    />
                    <label> Correo electrónico </label>
                    <input
                        type="email"
                        placeholder="Ingresa tu correo electrónico"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <label>Contraseña</label>
                    <input
                        type="password"
                        placeholder="Ingresa tu contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {error && <div className="auth-alert">{error}</div>}

                    <button type="submit" className="auth-btn-primary" disabled={loading}>
                        {loading ? "Registrando..." : "Registrarse"}
                    </button>
                    <div className="auth-footer-links">
                        <span className="auth-muted">¿Ya tienes una cuenta?</span>
                        <Link to="/" className="auth-link">Inicia sesión</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}