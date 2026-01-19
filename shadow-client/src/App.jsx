import { useState, useEffect } from "react";
import axios from "axios";
import Auth from "./components/Auth";
import Header from "./components/Header";
import QuickNotes from "./components/QuickNotes";
import UpcomingEvents from "./components/UpcomingEvents";
import Timeline from "./components/Timeline";
import ChatOverlay from "./components/ChatOverlay";
import ToastContainer from "./components/Toast";
import { API_BASE } from "./config";
import { parseEventDate } from "./utils";
import { Sparkles, ArrowLeftRight } from "lucide-react";

function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("shadow_token"));

  // --- DATA STATE ---
  const [mode, setMode] = useState("Professional");
  const [cards, setCards] = useState([]);
  const [events, setEvents] = useState([]);
  const [quickNotes, setQuickNotes] = useState([]);
  const [sortByPriority, setSortByPriority] = useState(true);

  // --- UI STATE ---
  const [chatHistory, setChatHistory] = useState([]);
  const [alertedEvents, setAlertedEvents] = useState(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // <--- Controls visibility
  const [showEventForm, setShowEventForm] = useState(false);
  const [toasts, setToasts] = useState([]);

  // --- TOGGLES ---
  const [showInsights, setShowInsights] = useState(true);
  const [timelineOnLeft, setTimelineOnLeft] = useState(true);

  // Theme Helpers
  const theme =
    mode === "Professional"
      ? "bg-slate-950 text-slate-100"
      : "bg-stone-50 text-stone-800";
  const accentColor =
    mode === "Professional"
      ? "bg-blue-600 hover:bg-blue-500"
      : "bg-orange-500 hover:bg-orange-400";
  const panelColor =
    mode === "Professional"
      ? "bg-slate-900 border-slate-800"
      : "bg-white border-stone-200 shadow-sm";

  // --- TOAST HELPERS ---
  const addToast = (message, title = "Notification", type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, title, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // --- LOAD DATA ---
  useEffect(() => {
    const storedUserId = localStorage.getItem("shadow_user_id");
    if (token && storedUserId) {
      setUser({ id: storedUserId });
      fetchData(storedUserId);
    }
  }, [token]);

  const fetchData = async (userId) => {
    try {
      const [res1, res2, res3] = await Promise.all([
        axios.get(`${API_BASE}/entries`, { params: { user_id: userId } }),
        axios.get(`${API_BASE}/events`, { params: { user_id: userId } }),
        axios.get(`${API_BASE}/quick-notes`, { params: { user_id: userId } }),
      ]);
      setCards(res1.data);
      setEvents(res2.data);
      setQuickNotes(res3.data);
    } catch (e) {
      console.error(e);
      addToast("Failed to load data", "Error", "error");
    }
  };

  const handleLogin = (data) => {
    localStorage.setItem("shadow_token", data.access_token);
    localStorage.setItem("shadow_user_id", data.user_id);
    setToken(data.access_token);
    setUser({ id: data.user_id, ...data.profile });
    addToast(`Welcome back, ${data.profile.name}!`, "Shadow Online", "success");
  };

  const logout = () => {
    localStorage.removeItem("shadow_token");
    localStorage.removeItem("shadow_user_id");
    setToken(null);
    setUser(null);
  };

  const handleGoogleSync = async () => {
    try {
      addToast("Connecting to Google...", "Sync Started");
      const res = await axios.get(`${API_BASE}/auth/google`, {
        params: { user_id: user.id },
      });
      window.location.href = res.data.url;
    } catch (e) {
      addToast("Could not connect to Google.", "Sync Failed", "error");
    }
  };

  // --- EVENT WATCHER ---
  useEffect(() => {
    const checkUpcomingEvents = () => {
      const now = new Date();
      events.forEach((event) => {
        if (
          alertedEvents.has(event._id) ||
          !event.time ||
          event.time === "All Day"
        )
          return;

        const eventTime = parseEventDate(event.date, event.time);
        if (!eventTime) return;

        const diffMins = Math.floor((eventTime - now) / 60000);

        if (diffMins <= 60 && diffMins > -5) {
          addToast(
            `"${event.title}" starts in ${diffMins} minutes.`,
            "Upcoming Event",
            "warning",
          );
          setAlertedEvents((prev) => new Set(prev).add(event._id));
        }
      });
    };
    const timer = setInterval(checkUpcomingEvents, 60000);
    checkUpcomingEvents();
    return () => clearInterval(timer);
  }, [events, alertedEvents]);

  // --- RENDER ---
  if (!token) return <Auth onLogin={handleLogin} />;

  return (
    <div
      className={`min-h-screen transition-colors duration-500 flex flex-col ${theme}`}
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Header
        mode={mode}
        setMode={setMode}
        sortByPriority={sortByPriority}
        setSortByPriority={setSortByPriority}
        logout={logout}
        accentColor={accentColor}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarOpen={isSidebarOpen}
      />

      {/* VIEW CONTROLS */}
      <div
        className={`px-6 py-2 border-b border-white/5 flex justify-end gap-4 text-xs font-bold uppercase tracking-wider ${
          mode === "Professional" ? "bg-slate-900/50" : "bg-stone-100"
        }`}
      >
        <button
          onClick={() => setShowInsights(!showInsights)}
          className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${
            showInsights ? "text-purple-400 bg-purple-500/10" : "opacity-40"
          }`}
        >
          <Sparkles size={14} />{" "}
          {showInsights ? "AI Insights: ON" : "AI Insights: OFF"}
        </button>
      </div>

      {/* MAIN GRID */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 h-full overflow-hidden">
        {/* --- LEFT COLUMN: HISTORY & EVENTS (Hidden if !isSidebarOpen) --- */}
        <div
          className={`
                h-[calc(100vh-140px)] flex flex-col gap-4 transition-all duration-300
                ${!isSidebarOpen ? "hidden" : "lg:col-span-4 flex"} 
            `}
        >
          {/* 1. TOP: TIMELINE (75%) */}
          <div className="flex-[3] min-h-0 overflow-hidden">
            <Timeline
              cards={cards.filter((c) =>
                showInsights ? true : c.type !== "ai_insight",
              )}
              setCards={setCards}
              user={user}
              mode={mode}
              panelColor={panelColor}
              accentColor={accentColor}
              isSidebarOpen={true}
              showInsights={showInsights}
            />
          </div>

          {/* 2. BOTTOM: EVENTS (25%) */}
          <div className="flex-[1] min-h-0 flex flex-col">
            <UpcomingEvents
              events={events}
              setEvents={setEvents}
              user={user}
              panelColor={panelColor}
              accentColor={accentColor}
              showEventForm={showEventForm}
              setShowEventForm={setShowEventForm}
            />
          </div>
        </div>

        {/* --- RIGHT COLUMN: MAIN NOTES (QuickNotes) --- */}
        <div
          className={`
                h-[calc(100vh-140px)] transition-all duration-300
                ${!isSidebarOpen ? "lg:col-span-12" : "lg:col-span-8"}
            `}
        >
          <QuickNotes
            notes={quickNotes}
            setNotes={setQuickNotes}
            user={user}
            mode={mode}
            sortByPriority={sortByPriority}
            panelColor={panelColor}
          />
        </div>
      </main>

      <ChatOverlay
        user={user}
        chatHistory={chatHistory}
        setChatHistory={setChatHistory}
        mode={mode}
        handleGoogleSync={handleGoogleSync}
        setIsSidebarOpen={setIsSidebarOpen}
        setShowEventForm={setShowEventForm}
      />
    </div>
  );
}

export default App;
