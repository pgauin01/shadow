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
import { Sparkles } from "lucide-react";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("shadow_token"));
  const [mode, setMode] = useState("Professional");
  const [shadowType, setShadowType] = useState("Career Mode");
  const [cards, setCards] = useState([]);
  const [events, setEvents] = useState([]);
  const [quickNotes, setQuickNotes] = useState([]);
  const [sortByPriority, setSortByPriority] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [alertedEvents, setAlertedEvents] = useState(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showInsights, setShowInsights] = useState(true);

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

  const addToast = (message, title = "Notification", type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, title, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const handlePersonaChange = async (newPersona) => {
    setShadowType(newPersona);
    if (user && user.id) {
      try {
        await axios.put(`${API_BASE}/users/${user.id}/mode`, {
          shadow_type: newPersona,
        });
        addToast(`AI Persona switched to ${newPersona}`, "Updated", "success");
      } catch (e) {
        console.error("Failed to sync persona", e);
      }
    }
  };

  useEffect(() => {
    const storedUserId = localStorage.getItem("shadow_user_id");
    if (token && storedUserId) {
      setUser({ id: storedUserId });
      fetchData(storedUserId);
    }
  }, [token]);

  const fetchData = async (userId) => {
    try {
      const [res1, res2, res3, res4] = await Promise.all([
        axios.get(`${API_BASE}/entries`, { params: { user_id: userId } }),
        axios.get(`${API_BASE}/events`, { params: { user_id: userId } }),
        axios.get(`${API_BASE}/quick-notes/`, { params: { user_id: userId } }),
        axios.get(`${API_BASE}/users/${userId}`),
      ]);

      setCards(res1.data);
      setEvents(res2.data);
      setQuickNotes(res3.data);

      // 👇 THE FIX: Normalize the data to match 'handleLogin' structure
      const backendUser = res4.data;
      setUser({
        id: backendUser.id || backendUser._id, // Handle both 'id' and '_id'
        ...backendUser.profile, // Flatten profile (so user.name works)
        profile: backendUser.profile, // Keep original profile object just in case
        workspaces: backendUser.profile.workspaces, // Ensure workspaces are accessible
      });

      if (backendUser.profile?.shadow_type) {
        setShadowType(backendUser.profile.shadow_type);
      }
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
    if (data.profile.shadow_type) {
      setShadowType(data.profile.shadow_type);
    }
    addToast(`Welcome back, ${data.profile.name}!`, "Shadow Online", "success");
  };

  const logout = () => {
    // 1. Clear Auth Data
    localStorage.removeItem("shadow_token");
    localStorage.removeItem("shadow_user_id");
    localStorage.removeItem("shadow_scratchpad");

    // 2. Clear Note Drafts (Crucial for Privacy)
    // We iterate over all keys and remove ones starting with "shadow_draft_"
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("shadow_draft_")) {
        localStorage.removeItem(key);
      }
    });

    // 3. Reset State
    setToken(null);
    setUser(null);
    setCards([]);
    setEvents([]);
    setQuickNotes([]);
    setChatHistory([]);
    addToast("Logged out successfully", "Goodbye", "info");
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

  if (!token) return <Auth onLogin={handleLogin} />;

  const refreshEvents = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API_BASE}/events`, {
        params: { user_id: user.id },
      });
      setEvents(res.data);
    } catch (e) {
      console.error("Failed to refresh events", e);
    }
  };

  const refreshNotes = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API_BASE}/quick-notes/`, {
        params: { user_id: user.id },
      });
      setQuickNotes(res.data);
    } catch (e) {
      console.error("Failed to refresh notes", e);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-500 flex flex-col ${theme}`}
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Header
        mode={mode}
        setMode={setMode}
        shadowType={shadowType}
        setShadowType={handlePersonaChange}
        sortByPriority={sortByPriority}
        setSortByPriority={setSortByPriority}
        logout={logout}
        accentColor={accentColor}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarOpen={isSidebarOpen}
      />

      <div
        className={`px-4 lg:px-6 py-2 border-b border-white/5 flex justify-end gap-4 text-xs font-bold uppercase tracking-wider ${mode === "Professional" ? "bg-slate-900/50" : "bg-stone-100"}`}
      >
        <button
          onClick={() => setShowInsights(!showInsights)}
          className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${showInsights ? "text-purple-400 bg-purple-500/10" : "opacity-40"}`}
        >
          <Sparkles size={14} />{" "}
          <span className="hidden sm:inline">
            {showInsights ? "AI Insights: ON" : "AI Insights: OFF"}
          </span>
          <span className="sm:hidden">
            {showInsights ? "AI: ON" : "AI: OFF"}
          </span>
        </button>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 h-auto lg:h-full overflow-y-auto lg:overflow-hidden">
        {/* LEFT COLUMN (Timeline + Events) */}
        <div
          className={`
            flex flex-col gap-4 transition-all duration-300
            order-2 lg:order-1
            h-auto lg:h-[calc(100vh-140px)]
            ${!isSidebarOpen ? "hidden" : "flex lg:col-span-4"}
          `}
        >
          {/* Timeline */}
          <div className="lg:flex-[3] min-h-[400px] lg:min-h-0 overflow-hidden">
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
          {/* Events */}
          <div className="lg:flex-[1] min-h-0 flex flex-col">
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

        {/* RIGHT COLUMN (Quick Notes) */}
        <div
          className={`
            transition-all duration-300 
            order-1 lg:order-2
            h-[500px] lg:h-[calc(100vh-140px)]
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
            onRefresh={refreshNotes}
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
        onEventCreated={refreshEvents}
      />
    </div>
  );
}

export default App;
