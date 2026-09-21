// admin-portal/src/pages/Settings.tsx
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backupApi, backupExportUrl, type BackupImportResult } from "../api";
import { useAuth } from "../auth/useAuth";
import { Icon } from "../components/icons";
import ConfirmDialog from "../components/ConfirmDialog";
import { getErrorMessage } from "../utils/errors";

// Etiquetas legibles para el resumen de "imported: { tabla: nº filas }" que
// devuelve el backend, en el mismo orden en que interesa mostrarlas.
const IMPORT_LABELS: Record<string, string> = {
  users: "Clientes",
  instances: "Aplicaciones contratadas",
  credentials: "Usuarios del portal",
  documents: "Documentos (PDF)",
  applications: "Aplicaciones del catálogo",
  services: "Servicios del catálogo",
  instanceServices: "Servicios contratados",
  credentialServices: "Permisos por usuario",
  payments: "Pagos registrados",
  menus: "Cartas",
  menuSections: "Secciones de carta",
  dishes: "Platos",
  reservations: "Reservas",
  orders: "Pedidos",
  orderItems: "Líneas de pedido",
};

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Importar ──
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BackupImportResult | null>(
    null,
  );

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si se cancela
    if (!file) return;
    setImportError(null);
    setPendingFile(file);
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setImportError(null);
    try {
      const text = await pendingFile.text();
      const result = await backupApi.import(text);
      setPendingFile(null);
      setImportResult(result);
    } catch (e: unknown) {
      setImportError(
        getErrorMessage(e, "No se pudo importar el archivo de backup."),
      );
    } finally {
      setImporting(false);
    }
  };

  // Tras un import correcto, la importación borra todas las sesiones (la
  // propia incluida): hay que volver a iniciar sesión sí o sí. Se avisa con
  // un resumen antes de redirigir.
  const finishAfterImport = async () => {
    setImportResult(null);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="px-6 lg:px-8 py-6 w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Ajustes
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Configuración general de la plataforma
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center text-teal-700 dark:text-teal-400">
            <Icon name="database" className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Copia de seguridad de la base de datos
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Incluye todos los clientes, sus aplicaciones y servicios
              contratados, credenciales, documentos generados (PDF), pagos,
              cartas, reservas y pedidos. En resumen: todo lo que hay en la base
              de datos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exportar */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Exportar
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Descarga un archivo con una copia completa de la base de datos
                tal y como está ahora mismo.
              </p>
            </div>
            <a
              href={backupExportUrl()}
              download
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-xl transition-colors"
            >
              <Icon name="download" className="w-4 h-4" strokeWidth={1.8} />
              Exportar base de datos
            </a>
          </div>

          {/* Importar */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Importar
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Sustituye <strong>todo</strong> lo que hay ahora por el
                contenido del archivo. No se puede deshacer.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-sm font-semibold rounded-xl transition-colors"
            >
              <Icon name="upload" className="w-4 h-4" strokeWidth={1.8} />
              Importar base de datos
            </button>
          </div>
        </div>
      </div>

      {/* Confirmación antes de importar (acción destructiva) */}
      {pendingFile && (
        <ConfirmDialog
          title="¿Sustituir toda la base de datos?"
          message={
            <>
              <p>
                Vas a importar{" "}
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {pendingFile.name}
                </span>
                .
              </p>
              <p>
                Esto <strong>borrará todos los datos actuales</strong>{" "}
                (clientes, contratos, pedidos, reservas...) y los sustituirá por
                completo por el contenido del archivo.
              </p>
              <p>Esta acción no se puede deshacer.</p>
              {importError && (
                <p className="text-red-700 dark:text-red-400 font-medium pt-1">
                  {importError}
                </p>
              )}
            </>
          }
          confirmLabel="Sí, sustituir todo"
          loadingLabel="Importando…"
          loading={importing}
          onConfirm={() => void confirmImport()}
          onCancel={() => {
            setPendingFile(null);
            setImportError(null);
          }}
        />
      )}

      {/* Resultado del import: hay que volver a iniciar sesión */}
      {importResult && (
        <ConfirmDialog
          title="Base de datos restaurada"
          message={
            <>
              <p>Se han importado correctamente:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {Object.entries(importResult.imported)
                  .filter(([, count]) => count > 0)
                  .map(([key, count]) => (
                    <li key={key}>
                      {count} · {IMPORT_LABELS[key] ?? key}
                    </li>
                  ))}
              </ul>
              <p className="pt-1">
                Por seguridad, se han cerrado todas las sesiones abiertas.
                Tendrás que volver a iniciar sesión.
              </p>
            </>
          }
          confirmLabel="Ir a iniciar sesión"
          loading={false}
          onConfirm={() => void finishAfterImport()}
          onCancel={() => void finishAfterImport()}
        />
      )}
    </div>
  );
}
