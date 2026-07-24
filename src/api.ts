import axios from 'axios';

export const api = axios.create({
  // Forzamos el localhost en el puerto 4000 directamente:
  baseURL: 'http://localhost:4000/api',
});

export function setAuth(token: string | null) {
    if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    else delete api.defaults.headers.common["Authorization"];
}

setAuth(localStorage.getItem("token"));

api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem("token");
            setAuth(null);
        }
        return Promise.reject(err);
    }
);