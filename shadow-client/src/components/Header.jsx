import {
  LayoutDashboard,
  ArrowUpDown,
  PanelLeftClose, // <--- NEW
  PanelLeftOpen,
} from "lucide-react";

export default function Header({
  mode,
  setMode,
  sortByPriority,
  setSortByPriority,
  logout,
  theme,
  accentColor,
  isSidebarOpen,
  setIsSidebarOpen,
}) {
  return (
    <header className="p-4 border-b border-white/5 sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="opacity-50 hover:opacity-100 transition-opacity"
            title={isSidebarOpen ? "Enter Zen Mode" : "Show Sidebar"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeftOpen size={20} />
            )}
          </button>
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentColor}`}
            >
              <LayoutDashboard size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Shadow</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setSortByPriority(!sortByPriority)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${
              sortByPriority
                ? "bg-purple-500/10 text-purple-400"
                : "opacity-40 hover:opacity-100"
            }`}
          >
            <ArrowUpDown size={14} />{" "}
            <span>{sortByPriority ? "Priority" : "Date"}</span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-2" />

          <div className="flex bg-black/10 dark:bg-white/5 p-1 rounded-lg">
            <button
              onClick={() => setMode("Professional")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === "Professional" ? "bg-slate-700 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
            >
              Work
            </button>
            <button
              onClick={() => setMode("Personal")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === "Personal" ? "bg-white text-stone-800 shadow-sm" : "text-gray-400 hover:text-stone-600"}`}
            >
              Life
            </button>
          </div>

          <button
            onClick={logout}
            className="ml-2 text-xs opacity-50 hover:opacity-100 hover:text-red-400"
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
}
