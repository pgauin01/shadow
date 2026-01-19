import {
  LayoutDashboard,
  ArrowUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
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
      <div className="max-w-7xl mx-auto flex justify-between items-center">
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
        <div className="flex items-center gap-4">
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
            <span>{sortByPriority ? "Priority" : "Date"}</span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-2" />

          {/* 1. UI MODE TOGGLE */}
          {/* <div className="flex bg-black/10 dark:bg-white/5 p-1 rounded-lg">
            <button
              onClick={() => setMode("Professional")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                mode === "Professional"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Work
            </button>
            <button
              onClick={() => setMode("Personal")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                mode === "Personal"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-gray-400 hover:text-stone-600"
              }`}
            >
              Life
            </button>
          </div> */}

          {/* 2. AI PERSONA DROPDOWN (Fixed Colors) */}
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
              <Users size={14} />
            </div>
            <select
              value={shadowType}
              onChange={(e) => setShadowType(e.target.value)}
              className={`appearance-none pl-9 pr-8 py-2 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-all uppercase tracking-wide
                ${
                  mode === "Professional"
                    ? "bg-slate-800 border-slate-700 text-white hover:border-slate-600" // Changed text-slate-300 to text-white
                    : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
            >
              {/* Added distinct classes for options so they are visible in the list */}
              <option
                className={
                  mode === "Professional"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-black"
                }
                value="Career Mode"
              >
                👔 Career Mode
              </option>
              <option
                className={
                  mode === "Professional"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-black"
                }
                value="Zen Mode"
              >
                🧘 Zen Mode
              </option>
              <option
                className={
                  mode === "Professional"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-black"
                }
                value="Witty Companion"
              >
                😜 Witty Companion
              </option>
              <option
                className={
                  mode === "Professional"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-black"
                }
                value="Drill Sergeant"
              >
                🪖 Drill Sergeant
              </option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-[10px]">
              ▼
            </div>
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
