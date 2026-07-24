import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import {
  cacheTasks,
  getAllTasksLocal,
  putTaskLocal,
  removeTaskLocal,
  queue,
  type OutboxOp,
} from "../assets/offline/db";
import { syncNow } from "../assets/offline/sync";
import "./Dashboard.css";

type Status = "Pendiente" | "En Progreso" | "Completada";

type Subtask = {
  _id?: string;
  title: string;
  description?: string;
  completed: boolean;
};

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: Status;
  clienteId?: string;
  createdAt?: string;
  deleted?: boolean;
  pending?: boolean;
  subtasks?: Subtask[];
  progress?: number;
};

const isLocalId = (id: string) => !/^[a-f0-9]{24}$/i.test(id);

function statusClass(status: Status) {
  if (status === "Completada") return "status-completada";
  if (status === "En Progreso") return "status-en-progreso";
  return "status-pendiente";
}

function statusLabel(status: Status) {
  return status;
}

function computeProgress(t: Task): number {
  if (t.subtasks && t.subtasks.length > 0) {
    const done = t.subtasks.filter((s) => s.completed).length;
    return Math.round((done / t.subtasks.length) * 100);
  }
  return t.progress ?? 0;
}

function normalizeTask(x: any): Task {
  return {
    _id: String(x?._id ?? x?.id),
    title: String(x?.title ?? "(sin título)"),
    description: x?.description ?? "",
    status:
      x?.status === "Completada" ||
      x?.status === "En Progreso" ||
      x?.status === "Pendiente"
        ? x.status
        : "Pendiente",
    clienteId: x?.clienteId,
    createdAt: x?.createdAt,
    deleted: !!x?.deleted,
    pending: !!x?.pending,
    subtasks: Array.isArray(x?.subtasks) ? x.subtasks : [],
    progress: typeof x?.progress === "number" ? x.progress : 0,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [showAddForm, setShowAddForm] = useState(false);

  const [userName, setUserName] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuth(localStorage.getItem("token"));

    const name = localStorage.getItem("userName") || "Usuario";
    setUserName(name);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    const on = async () => {
      setOnline(true);
      await syncNow();
      await loadFromServer();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    (async () => {
      const local = await getAllTasksLocal();
      if (local?.length) setTasks(local.map(normalizeTask));
      await loadFromServer();
      await syncNow();
      await loadFromServer();
    })();

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function loadFromServer() {
    try {
      const { data } = await api.get("/tasks");
      const raw = Array.isArray(data?.items) ? data.items : [];
      const list = raw.map(normalizeTask);
      setTasks(list);
      await cacheTasks(list);
    } catch {
      // si falla, nos quedamos con lo local
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");

    if (newPassword !== confirmPassword) {
      setModalError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    if (!navigator.onLine) {
      setModalError("Debes estar online para cambiar tu contraseña.");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.put("/auth/change-password", { currentPassword, newPassword });

      setModalSuccess("¡Contraseña actualizada correctamente!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setModalOpen(false), 2000);
    } catch (err: any) {
      setModalError(err.response?.data?.message || "Error al cambiar la contraseña.");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const d = description.trim();
    if (!t) return;

    const clienteId = crypto.randomUUID();
    const localTask = normalizeTask({
      _id: clienteId,
      title: t,
      description: d,
      status: "Pendiente" as Status,
      pending: !navigator.onLine,
    });

    setTasks((prev) => [localTask, ...prev]);
    await putTaskLocal(localTask);
    setTitle("");
    setDescription("");
    setShowAddForm(false);

    if (!navigator.onLine) {
      const op: OutboxOp = {
        id: "op-" + clienteId,
        op: "create",
        clienteId,
        data: localTask,
        ts: Date.now(),
      } as any;
      await queue(op);
      return;
    }

    try {
      const { data } = await api.post("/tasks", { title: t, description: d });
      const created = normalizeTask(data?.task ?? data);
      setTasks((prev) => prev.map((x) => (x._id === clienteId ? created : x)));
      await putTaskLocal(created);
    } catch {
      const op: OutboxOp = {
        id: "op-" + clienteId,
        op: "create",
        clienteId,
        data: localTask,
        ts: Date.now(),
      } as any;
      await queue(op);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task._id);
    setEditingTitle(task.title);
    setEditingDescription(task.description ?? "");
  }

  async function saveEdit(taskId: string) {
    const newTitle = editingTitle.trim();
    const newDesc = editingDescription.trim();
    if (!newTitle) return;

    const before = tasks.find((t) => t._id === taskId);
    const patched = { ...before, title: newTitle, description: newDesc } as Task;

    setTasks((prev) => prev.map((t) => (t._id === taskId ? patched : t)));
    await putTaskLocal(patched);
    setEditingId(null);

    const cId = isLocalId(taskId) ? taskId : (before?.clienteId ?? "");

    if (!navigator.onLine) {
      await queue({
        id: "upd-" + taskId,
        op: "update",
        clienteId: cId || undefined,
        serverId: isLocalId(taskId) ? undefined : taskId,
        data: { title: newTitle, description: newDesc },
        ts: Date.now(),
      } as OutboxOp);
      return;
    }

    try {
      await api.put(`/tasks/${taskId}`, { title: newTitle, description: newDesc });
    } catch {
      await queue({
        id: "upd-" + taskId,
        op: "update",
        clienteId: cId || undefined,
        serverId: taskId,
        data: { title: newTitle, description: newDesc },
        ts: Date.now(),
      } as OutboxOp);
    }
  }

  async function handleStatusChange(task: Task, newStatus: Status) {
    const updated = { ...task, status: newStatus };
    setTasks((prev) => prev.map((x) => (x._id === task._id ? updated : x)));
    await putTaskLocal(updated);

    const cId = task.clienteId ?? "";

    if (!navigator.onLine) {
      await queue({
        id: "upd-" + task._id,
        op: "update",
        serverId: isLocalId(task._id) ? undefined : task._id,
        clienteId: cId || undefined,
        data: { status: newStatus },
        ts: Date.now(),
      } as OutboxOp);
      return;
    }

    try {
      await api.put(`/tasks/${task._id}`, { status: newStatus });
    } catch {
      await queue({
        id: "upd-" + task._id,
        op: "update",
        serverId: task._id,
        clienteId: cId || undefined,
        data: { status: newStatus },
        ts: Date.now(),
      } as OutboxOp);
    }
  }

  async function removeTask(taskId: string) {
    const backup = tasks;
    const taskToDelete = tasks.find((t) => t._id === taskId);
    const cId = taskToDelete?.clienteId ?? "";

    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    await removeTaskLocal(taskId);

    if (!navigator.onLine) {
      await queue({
        id: "del-" + taskId,
        op: "delete",
        serverId: isLocalId(taskId) ? undefined : taskId,
        clienteId: cId || undefined,
        ts: Date.now(),
      } as OutboxOp);
      return;
    }

    try {
      await api.delete(`/tasks/${taskId}`);
    } catch {
      setTasks(backup);
      for (const t of backup) await putTaskLocal(t);
      await queue({
        id: "del-" + taskId,
        op: "delete",
        serverId: taskId,
        clienteId: cId || undefined,
        ts: Date.now(),
      } as OutboxOp);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    setAuth(null);
    window.location.href = "/";
  }

  function goToDetail(taskId: string) {
    if (isLocalId(taskId)) return;
    navigate(`/tasks/${taskId}`);
  }

  const filtered = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(s) ||
          (t.description || "").toLowerCase().includes(s)
      );
    }
    if (filter === "all") return list;
    if (filter === "active") list = list.filter((t) => t.status !== "Completada");
    if (filter === "completed") list = list.filter((t) => t.status === "Completada");
    return list;
  }, [tasks, search, filter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "Completada").length;
    const focus = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pending: total - done, focus };
  }, [tasks]);

  const userInitial = userName.charAt(0).toUpperCase();
  const firstName = userName.split(" ")[0];

  return (
    <div className="tb-wrap">
      <header className="tb-topbar">
        <div className="tb-brand">
          <div className="tb-brand-badge">✓</div>
          <div>
            <h1>To-do Karlita</h1>
            <span className="tb-brand-sub">Stay Focused</span>
          </div>
        </div>

        <div className="tb-spacer" />

        <div className={`tb-connection ${online ? "online" : "offline"}`}>
          {online ? "Online" : "Offline"}
        </div>

        <div className="tb-profile-container" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`tb-profile-btn${dropdownOpen ? " open" : ""}`}
          >
            <div className="tb-avatar">{userInitial}</div>
            <span className="tb-profile-name">{userName} ▾</span>
          </button>

          {dropdownOpen && (
            <div className="tb-dropdown">
              <div className="tb-dropdown-header">Configuraciones</div>
              <button
                className="tb-dropdown-item"
                onClick={() => { setModalOpen(true); setDropdownOpen(false); }}
              >
                🔑 Cambiar Contraseña
              </button>
              <button className="tb-dropdown-item danger" onClick={logout}>
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="tb-main">
        <div className="tb-hero">
          <div>
            <h2>Buenos días, {firstName}</h2>
            <p>Tienes {stats.pending} tareas pendientes por hacer ¿empezamos?.</p>
          </div>
          <div className="tb-hero-pills">
            {/* <div className="tb-pill pill-focus">
              <span className="pill-value">{stats.focus}%</span>
              <span className="pill-label">Focus</span>
            </div> */}
            <div className="tb-pill pill-done">
              <span className="pill-value">{stats.done}</span>
              <span className="pill-label">Hechas</span>
            </div>
            <div className="tb-pill pill-total">
              <span className="pill-value">{stats.total}</span>
              <span className="pill-label">Total</span>
            </div>
          </div>
        </div>

        <div className="tb-toolbar">
          <input
            className="tb-search"
            placeholder="Buscar tus tareas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="tb-filters">
            <button
              className={filter === "all" ? "tb-chip active" : "tb-chip"}
              onClick={() => setFilter("all")}
              type="button"
            >
              Todas
            </button>
            <button
              className={filter === "active" ? "tb-chip active" : "tb-chip"}
              onClick={() => setFilter("active")}
              type="button"
            >
              Activas
            </button>
            <button
              className={filter === "completed" ? "tb-chip active" : "tb-chip"}
              onClick={() => setFilter("completed")}
              type="button"
            >
              Hechas
            </button>
          </div>
          <button
            type="button"
            className="tb-btn-primary tb-new-task-btn"
            onClick={() => setShowAddForm((s) => !s)}
          >
            {showAddForm ? "Cancelar" : "+ Nueva tarea"}
          </button>
        </div>

        {showAddForm && (
          <form className="tb-add-card" onSubmit={addTask}>
            <label>Nombre de la tarea</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué necesitas hacer?"
              autoFocus
            />
            <label>Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agrega notas sobre esta tarea…"
              rows={2}
            />
            <button className="tb-btn-primary" type="submit">Crear tarea</button>
          </form>
        )}

        <h3 className="tb-section-title">Tus tareas</h3>

        {loading ? (
          <p className="tb-loading">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="tb-empty">Sin tareas por aquí. ¡Crea la primera! 🌸</p>
        ) : (
          <ul className="tb-task-list">
            {filtered.map((t) => {
              const progress = computeProgress(t);
              return (
                <li key={t._id} className="tb-task-card">
                  <div className="tb-task-top">
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t, e.target.value as Status)}
                      className={`tb-status-select ${statusClass(t.status)}`}
                      title="Estado"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Progreso">En Progreso</option>
                      <option value="Completada">Completada</option>
                    </select>

                    <div className="tb-task-actions">
                      {editingId === t._id ? (
                        <button className="tb-btn-primary tb-btn-small" onClick={() => saveEdit(t._id)}>
                          Guardar
                        </button>
                      ) : (
                        <button className="tb-icon" title="Editar" onClick={() => startEdit(t)}>✏️</button>
                      )}
                      <button className="tb-icon danger" title="Eliminar" onClick={() => removeTask(t._id)}>
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div
                    className="tb-task-content"
                    onClick={() => editingId !== t._id && goToDetail(t._id)}
                  >
                    {editingId === t._id ? (
                      <>
                        <input
                          className="tb-edit-field"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          placeholder="Título"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <textarea
                          className="tb-edit-field"
                          value={editingDescription}
                          onChange={(e) => setEditingDescription(e.target.value)}
                          placeholder="Descripción"
                          rows={2}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </>
                    ) : (
                      <>
                        <span className={`tb-task-title${t.status === "Completada" ? " done" : ""}`}>
                          {t.title}
                        </span>
                        {t.description && <p className="tb-task-desc">{t.description}</p>}

                        <div className="tb-progress-row">
                          <div className="tb-progress-track">
                            <div className="tb-progress-fill" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="tb-progress-label">{progress}%</span>
                          {t.subtasks && t.subtasks.length > 0 && (
                            <span className="tb-subtask-count">
                              {t.subtasks.filter((s) => s.completed).length}/{t.subtasks.length} subtareas
                            </span>
                          )}
                        </div>

                        {(t.pending || isLocalId(t._id)) && (
                          <span className="tb-badge-sync" title="Aún no sincronizada">
                            Falta sincronizar
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {modalOpen && (
        <div className="tb-modal-backdrop">
          <div className="tb-modal-content">
            <h3>Cambiar Contraseña</h3>
            <form onSubmit={handleChangePassword} className="tb-modal-form">
              <div>
                <label>Contraseña Actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Nueva Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {modalError && <div className="tb-modal-error">⚠️ {modalError}</div>}
              {modalSuccess && <div className="tb-modal-success">🎉 {modalSuccess}</div>}

              <div className="tb-modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="tb-btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={passwordLoading} className="tb-btn-primary">
                  {passwordLoading ? "Actualizando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}