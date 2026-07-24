import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import "./TaskDetail.css";

type Subtask = {
  _id: string;
  title: string;
  description?: string;
  completed: boolean;
};

type Status = "Pendiente" | "En Progreso" | "Completada";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: Status;
  subtasks: Subtask[];
  progress: number;
};

function statusClass(status: Status) {
  return "tbd-status-" + status.toLowerCase().replace(" ", "-");
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSubTitle, setNewSubTitle] = useState("");
  const [newSubDesc, setNewSubDesc] = useState("");
  const [manualProgress, setManualProgress] = useState(0);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/tasks/${id}`);
      setTask(data.task);
      setManualProgress(data.task.progress ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.message || "No se pudo cargar la tarea");
    } finally {
      setLoading(false);
    }
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    const title = newSubTitle.trim();
    if (!title) return;
    try {
      const { data } = await api.post(`/tasks/${id}/subtasks`, {
        title,
        description: newSubDesc.trim(),
      });
      setTask(data.task);
      setNewSubTitle("");
      setNewSubDesc("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al agregar subtarea");
    }
  }

  async function toggleSubtask(sub: Subtask) {
    try {
      const { data } = await api.put(`/tasks/${id}/subtasks/${sub._id}`, {
        completed: !sub.completed,
      });
      setTask(data.task);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al actualizar subtarea");
    }
  }

  async function removeSubtask(subId: string) {
    try {
      const { data } = await api.delete(`/tasks/${id}/subtasks/${subId}`);
      setTask(data.task);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al eliminar subtarea");
    }
  }

  async function saveManualProgress() {
    try {
      const { data } = await api.patch(`/tasks/${id}/progress`, {
        progress: manualProgress,
      });
      setTask(data.task);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al actualizar progreso");
    }
  }

  if (loading) return <div className="tbd-wrap"><p className="tbd-loading">Cargando…</p></div>;
  if (error && !task) return <div className="tbd-wrap"><p className="tbd-loading">{error}</p></div>;
  if (!task) return null;

  const hasSubtasks = task.subtasks.length > 0;
  const doneCount = task.subtasks.filter((s) => s.completed).length;

  return (
    <div className="tbd-wrap">
      <div className="tbd-container">
        <button className="tbd-back-btn" onClick={() => navigate(-1)}>← Volver al Dashboard</button>

        <div className="tbd-card">
          <div className="tbd-header">
            <h1>{task.title}</h1>
            <span className={`tbd-status-pill ${statusClass(task.status)}`}>
              {task.status}
            </span>
          </div>

          {task.description && <p className="tbd-desc">{task.description}</p>}

          <div className="tbd-progress-section">
            <div className="tbd-progress-track">
              <div className="tbd-progress-fill" style={{ width: `${task.progress}%` }} />
            </div>
            <span className="tbd-progress-label">{task.progress}%</span>
          </div>

          {hasSubtasks ? (
            <p className="tbd-progress-note">
              Progreso automático — {doneCount}/{task.subtasks.length} subtareas completadas
            </p>
          ) : (
            <div className="tbd-manual-progress">
              <label>Progreso manual (sin subtareas)</label>
              <div className="tbd-manual-row">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={manualProgress}
                  onChange={(e) => setManualProgress(Number(e.target.value))}
                />
                <span className="tbd-manual-value">{manualProgress}%</span>
                <button className="tbd-btn-primary tbd-btn-small" onClick={saveManualProgress}>
                  Guardar
                </button>
              </div>
            </div>
          )}

          {error && <div className="tbd-error">⚠️ {error}</div>}

          <h2 className="tbd-subtasks-title">Subtareas</h2>

          <form className="tbd-subtask-form" onSubmit={addSubtask}>
            <input
              value={newSubTitle}
              onChange={(e) => setNewSubTitle(e.target.value)}
              placeholder="Título de la subtarea…"
            />
            <input
              value={newSubDesc}
              onChange={(e) => setNewSubDesc(e.target.value)}
              placeholder="Descripción (opcional)…"
            />
            <button className="tbd-btn-primary" type="submit">Agregar</button>
          </form>

          {task.subtasks.length === 0 ? (
            <p className="tbd-empty">Aún no hay subtareas 🌸</p>
          ) : (
            <ul className="tbd-subtask-list">
              {task.subtasks.map((s) => (
                <li key={s._id} className={`tbd-subtask-item${s.completed ? " completed" : ""}`}>
                  <input
                    type="checkbox"
                    checked={s.completed}
                    onChange={() => toggleSubtask(s)}
                  />
                  <div className="tbd-subtask-content">
                    <span className="tbd-subtask-title">{s.title}</span>
                    {s.description && <p className="tbd-subtask-desc">{s.description}</p>}
                  </div>
                  <button className="tbd-icon-danger" onClick={() => removeSubtask(s._id)}>🗑️</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}