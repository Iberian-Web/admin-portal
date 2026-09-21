// admin-portal/src/components/Sidebar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import ThemeToggle from "./ThemeToggle";
import { Icon } from "./icons";

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

const navItems = [
  {
    to: "/",
    label: "Clientes",
    icon: <Icon name="users" className="w-4 h-4" strokeWidth={1.8} />,
  },
  {
    to: "/applications",
    label: "Aplicaciones",
    icon: <Icon name="grid" className="w-4 h-4" strokeWidth={1.8} />,
  },
];

// ─── Shared sidebar content ───────────────────────────────────────────────────
function SidebarContent({
  onLinkClick,
  handleLogout,
  collapsed,
  onToggleCollapse,
}: {
  onLinkClick?: () => void;
  handleLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      {/* Header / Title */}
      <div className="h-16 flex items-center justify-between gap-2 px-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        {!collapsed && (
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Administrador
          </span>
        )}
        <div
          className={`flex items-center gap-1 ${collapsed ? "mx-auto" : "ml-auto"}`}
        >
          {!collapsed && <ThemeToggle className="shrink-0" />}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex w-8 h-8 items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <Icon
                name="arrowLeft"
                className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2 mb-2">
            Principal
          </p>
        )}
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            onClick={onLinkClick}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${
                isActive
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`
            }
          >
            {icon}
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Session actions */}
      <div className="px-3 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0 space-y-2">
        {collapsed && <ThemeToggle className="mx-auto" />}
        <NavLink
          to="/settings"
          onClick={onLinkClick}
          title={collapsed ? "Ajustes" : undefined}
          className={({ isActive }) =>
            `w-full px-3 h-9 text-sm rounded-lg transition-colors flex items-center gap-2.5 ${collapsed ? "justify-center" : ""} ${
              isActive
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            }`
          }
        >
          <Icon
            name="settings"
            className="w-4 h-4 shrink-0"
            strokeWidth={1.8}
          />
          {!collapsed && "Ajustes"}
        </NavLink>
        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={`w-full px-3 h-9 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-lg transition-colors text-left flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.8} />
          {!collapsed && "Cerrar sesión"}
        </button>
      </div>
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const closeDrawer = () => setMobileOpen(false);

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Administrador
        </span>

        {/* Hamburger */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative w-9 h-9 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none"
            aria-label="Abrir menú"
          >
            <div className="absolute w-5 h-4 flex flex-col justify-between items-center">
              <span
                className={`h-0.5 w-full bg-current rounded transform transition-all duration-300 ${
                  mobileOpen ? "rotate-45 translate-y-1.75" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full bg-current rounded transition-all duration-300 ${mobileOpen ? "opacity-0 scale-0" : ""}`}
              />
              <span
                className={`h-0.5 w-full bg-current rounded transform transition-all duration-300 ${
                  mobileOpen ? "-rotate-45 -translate-y-2.25" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </header>

      {/* ── Mobile drawer backdrop ──────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer (opens from top, full width, auto height) ─────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 right-0 z-50 w-full max-h-[85vh] bg-white dark:bg-zinc-900 flex flex-col rounded-b-2xl shadow-xl overflow-hidden transform origin-top transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <SidebarContent onLinkClick={closeDrawer} handleLogout={handleLogout} />
      </div>

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col h-screen sticky top-0 transition-all duration-200 ${
          collapsed ? "w-18" : "w-56"
        }`}
      >
        <SidebarContent
          handleLogout={handleLogout}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>
    </>
  );
}
