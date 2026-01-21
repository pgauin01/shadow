import {
  LayoutDashboard,
  ArrowUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  LogOut,
} from "lucide-react";

export default function Header({
  mode,
  setMode,
  shadowType,
  setShadowType,
  sortByPriority,
  setSortByPriority,
  logout,
  accentColor,
  isSidebarOpen,
  setIsSidebarOpen,
}) {
  return (
    <header className="p-4 border-b border-white/5 sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-4 justify-between items-center">
        {/* LEFT: Sidebar Toggle & Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="opacity-50 hover:opacity-100 transition-opacity"
            title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
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

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          {/* Priority Sort Toggle */}
          <button
            onClick={() => setSortByPriority(!sortByPriority)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${
              sortByPriority
                ? "bg-purple-500/10 text-purple-400"
                : "opacity-40 hover:opacity-100"
            }`}
          >
            <ArrowUpDown size={14} />{" "}
            <span className="hidden sm:inline">
              {sortByPriority ? "Priority" : "Date"}
            </span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-2 hidden sm:block" />

          {/* AI PERSONA DROPDOWN */}
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
              <Users size={14} />
            </div>

            {/* FIXED SELECT ELEMENT */}
            <select
              value={shadowType}
              onChange={(e) => setShadowType(e.target.value)}
              className={`appearance-none pl-9 pr-8 py-2 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-all uppercase tracking-wide
                ${
                  mode === "Professional"
                    ? "bg-slate-800 border-slate-700 text-white hover:border-slate-600"
                    : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
            >
              {/* REMOVED <span> TAGS FROM OPTIONS */}
              <option
                className={
                  mode === "Professional" ? "bg-slate-800" : "bg-white"
                }
                value="Career Mode"
              >
                👔 Career Mode
              </option>
              <option
                className={
                  mode === "Professional" ? "bg-slate-800" : "bg-white"
                }
                value="Zen Mode"
              >
                🧘 Zen Mode
              </option>
              <option
                className={
                  mode === "Professional" ? "bg-slate-800" : "bg-white"
                }
                value="Witty Companion"
              >
                😜 Witty Companion
              </option>
              <option
                className={
                  mode === "Professional" ? "bg-slate-800" : "bg-white"
                }
                value="Drill Sergeant"
              >
                🪖 Drill Sergeant
              </option>
            </select>
          </div>

          {/* LOGOUT BUTTON */}
          <button
            onClick={logout}
            className="ml-2 flex items-center gap-2 text-xs opacity-50 hover:opacity-100 hover:text-red-400 transition-colors"
            title="Log Out"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
