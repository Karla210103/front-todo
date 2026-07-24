import {api} from '../../api';

import {
    getOutbox,
    clearOutbox,
    setMapping,
    getMapping,
    removeTaskLocal,
    promoteLocalToServer,
} from './db';

let syncing = false;
let lastSyncAt = 0;

export async function syncNow() {
    if (!navigator.onLine) return;

    const now = Date.now();
    if (now - lastSyncAt < 1500) return;
    lastSyncAt = now;

    if (syncing) return;
    syncing = true;

    try {
        const ops = (await getOutbox() as any[]).sort((a, b) => a.ts - b.ts);
        if (ops.length === 0) return;

        const toSync: any[] = [];

        for (const op of ops) {
            if (op.op === "create") {
                toSync.push({
                    clienteId: op.clienteId,
                    title: op.data.title,
                    description: op.data.description ?? "",
                    status: op.data.status ?? "Pendiente",
                    subtasks: op.data.subtasks,
                    progress: op.data.progress,
                });
            } else if (op.op === "update") {
                // Si ya tiene serverId, actualizamos directo. Si no, aún vive solo
                // localmente y hay que subirla vía bulksync por clienteId.
                if (op.serverId) {
                    try {
                        await api.put(`/tasks/${op.serverId}`, op.data);
                    } catch {
                        // se reintenta en la próxima sincronización
                    }
                } else if (op.clienteId) {
                    toSync.push({
                        clienteId: op.clienteId,
                        title: op.data.title,
                        description: op.data.description,
                        status: op.data.status,
                        subtasks: op.data.subtasks,
                        progress: op.data.progress,
                    });
                }
            }
        }

        if (toSync.length) {
            try {
                const { data } = await api.post("/tasks/bulksync", { tasks: toSync });
                for (const map of data?.mapping || []) {
                    await setMapping(map.clienteId, map.serverId);
                    await promoteLocalToServer(map.clienteId, map.serverId);
                }
            } catch {
                return;
            }
        }

        for (const op of ops) {
            if (op.op !== "delete") continue;
            const serverId = op.serverId ?? (op.clienteId ? await getMapping(op.clienteId) : undefined);
            if (!serverId) continue;
            try {
                await api.delete(`/tasks/${serverId}`);
                await removeTaskLocal(op.clienteId || serverId);
            } catch {
                // se reintenta en la próxima sincronización
            }
        }

        await clearOutbox();
    } finally {
        syncing = false;
    }
}

export function setupOnlineSync() {
    const handler = () => {
        void syncNow();
    };
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
}