import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Send,
  LayoutDashboard,
  History,
  Calendar,
  Plus,
  Trash2,
  Check,
  MessageSquare,
  X,
  Sparkles,
  LogIn,
  ArrowUpDown,
  Loader2,
  User,
  Camera,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "http://localhost:8000";

function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("shadow_token"));
  const [authMode, setAuthMode] = useState("login");

  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    age: "",
    gender: "",
    profession: "",
    shadow_type: "Career Mode", // Default Personality
    current_focus: "",
  });
  const [authError, setAuthError] = useState("");

  // --- DASHBOARD STATE ---
  const [mode, setMode] = useState("Professional");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([]);
  const [events, setEvents] = useState([]);
  const [quickNotes, setQuickNotes] = useState([]);

  // Quick Note / Event UI State
  const [sortByPriority, setSortByPriority] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [tempNoteContent, setTempNoteContent] = useState("");
  const [tempNotePriority, setTempNotePriority] = useState("Medium");
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    type: "Work",
  });
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // Base64 string
  const fileInputRef = useRef(null); // Reference to hidden input
  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const [alertedEvents, setAlertedEvents] = useState(new Set());

  console.log("events", events);

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

  // --- PASTE THIS HELPER FUNCTION HERE (Before "function App") ---
  const parseEventDate = (dateStr, timeStr) => {
    if (!timeStr || timeStr === "All Day") return null;

    // Convert "02:30 PM" to 24-hour format
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":");

    if (hours === "12") hours = "00";
    if (modifier === "PM") hours = parseInt(hours, 10) + 12;

    // Create Date Object combined with the Event Date
    return new Date(`${dateStr}T${hours}:${minutes}:00`);
  };
  // 2. The "Chatbot Alert" Watcher
  useEffect(() => {
    const checkUpcomingEvents = () => {
      const now = new Date();

      events.forEach((event) => {
        // Check if already alerted
        if (
          alertedEvents.has(event._id) ||
          !event.time ||
          event.time === "All Day"
        )
          return;

        const eventTime = parseEventDate(event.date, event.time);
        if (!eventTime) return;

        const diffMs = eventTime - now;
        const diffMins = Math.floor(diffMs / 60000);

        console.log("diffMs", diffMs);

        // Trigger if within 60 mins
        if (diffMins <= 60 && diffMins > 0) {
          // --- THE CHANGE: PUSH TO CHAT HISTORY ---
          const alertMessage = {
            role: "ai",
            text: `🔔 **Heads up!** Your event "${event.title}" starts in ${diffMins} minutes.`,
            isAlert: true, // Mark this so we can style it differently
          };

          setChatHistory((prev) => [...prev, alertMessage]);

          // Add to 'Alerted' set
          setAlertedEvents((prev) => new Set(prev).add(event._id));
        }
      });
    };

    const timer = setInterval(checkUpcomingEvents, 60000); // Check every minute
    checkUpcomingEvents(); // Run once immediately

    return () => clearInterval(timer);
  }, [events, alertedEvents]);

  // --- 1. HANDLE LOGIN / SIGNUP ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      if (authMode === "signup") {
        // Register with NEW Profile Structure
        await axios.post(`${API_BASE}/register`, {
          email,
          password,
          profile: {
            name: profile.name,
            age: parseInt(profile.age),
            gender: profile.gender,
            profession: profile.profession,
            shadow_type: profile.shadow_type,
            current_focus: profile.current_focus,
          },
        });
        setAuthMode("login");
        setAuthError("Account created! Please log in.");
      } else {
        // Login
        const formData = new FormData();
        formData.append("username", email);
        formData.append("password", password);

        const res = await axios.post(`${API_BASE}/token`, formData);

        const accessToken = res.data.access_token;
        const userId = res.data.user_id;
        const userProfile = res.data.profile;

        localStorage.setItem("shadow_token", accessToken);
        localStorage.setItem("shadow_user_id", userId);

        setToken(accessToken);
        setUser({ id: userId, ...userProfile });
        window.location.reload();
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result); // This sets the "data:image/png;base64..." string
      };
      reader.readAsDataURL(file);
    }
  };

  const logout = () => {
    localStorage.removeItem("shadow_token");
    localStorage.removeItem("shadow_user_id");
    setToken(null);
    setUser(null);
  };

  // --- 2. LOAD DATA ---
  useEffect(() => {
    const storedUserId = localStorage.getItem("shadow_user_id");
    if (token && storedUserId) {
      setUser({ id: storedUserId });
      fetchData(storedUserId);
    }
  }, [token]);

  // Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, showChat]);

  const fetchData = async (userId) => {
    try {
      // Pass user_id to ALL endpoints now
      const p1 = axios.get(`${API_BASE}/entries`, {
        params: { user_id: userId },
      });
      const p2 = axios.get(`${API_BASE}/events`, {
        params: { user_id: userId },
      }); // <--- Added param
      const p3 = axios.get(`${API_BASE}/quick-notes`, {
        params: { user_id: userId },
      }); // <--- Added param
      const [res1, res2, res3] = await Promise.all([p1, p2, p3]);
      setCards(res1.data);
      setEvents(res2.data);
      setQuickNotes(res3.data);
    } catch (e) {
      console.error(e);
    }
  };

  // --- ACTIONS ---
  const handleSubmitNote = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/entries`, {
        raw_text: input,
        user_id: user.id,
      });
      setCards([res.data, ...cards]);
      setInput("");
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  // Inside src/App.jsx

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() && !selectedImage) return;

    // 1. Create the User Message Object (Consistent names!)
    const userMessage = {
      role: "user",
      text: chatInput, // <--- CHANGED from 'content' to 'text' to match your history
      image: selectedImage, // <--- Store the base64 image to display it
      history: chatHistory,
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setChatInput("");
    setSelectedImage(null);
    setChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        message: userMessage.text || "Analyze this image",
        user_id: user.id,
        image: userMessage.image,
        history: chatHistory,
      });

      // 2. Add AI Response
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: res.data.response },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: "I can't see right now. (Server Error)" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const generateInsight = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/insights/generate`, null, {
        params: { user_id: user.id },
      });
      await fetchData(user.id);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  // Quick Notes Logic
  const handleAddQuickNote = async () => {
    try {
      // Send user.id in the body
      const res = await axios.post(`${API_BASE}/quick-notes`, {
        content: "New Note...",
        priority: "Medium",
        user_id: user.id, // <--- ADDED
      });
      setQuickNotes([res.data, ...quickNotes]);
      startEditing(res.data);
    } catch (e) {
      console.error(e);
    }
  };
  const startEditing = (note) => {
    setEditingNoteId(note._id);
    setTempNoteContent(note.content);
    setTempNotePriority(note.priority || "Medium");
  };
  // In src/App.jsx

  const handleSaveQuickNote = async (id) => {
    try {
      // 1. OPTIMISTIC UPDATE: Update UI immediately before server responds
      // We guess the 'final_priority' so the color snaps instantly.
      // If it's "Auto", we keep it as is (or set to Medium) until AI finishes.
      const optimisticPriority =
        tempNotePriority === "Auto" ? "Medium" : tempNotePriority;

      const updatedList = quickNotes.map((n) =>
        n._id === id
          ? {
              ...n,
              content: tempNoteContent,
              priority: tempNotePriority,
              final_priority: optimisticPriority, // <--- FORCE COLOR CHANGE INSTANTLY
            }
          : n
      );

      setQuickNotes(updatedList);
      setEditingNoteId(null); // Close editor immediately

      // 2. SEND TO SERVER
      const res = await axios.put(`${API_BASE}/quick-notes/${id}`, {
        content: tempNoteContent,
        priority: tempNotePriority,
      });

      // 3. UPDATE WITH REAL SERVER DATA (Handles "Auto" AI result)
      setQuickNotes((current) =>
        current.map((n) => (n._id === id ? res.data : n))
      );
    } catch (e) {
      console.error("Save failed", e);
      // Optional: Revert changes here if error
    }
  };

  const handleDeleteQuickNote = async (id) => {
    try {
      await axios.delete(`${API_BASE}/quick-notes/${id}`);
      setQuickNotes(quickNotes.filter((n) => n._id !== id));
    } catch (e) {}
  };

  const handleGoogleSync = async () => {
    try {
      // 1. Ask Backend for the Google Login URL
      const res = await axios.get(`${API_BASE}/auth/google`, {
        params: { user_id: user.id },
      });

      // 2. Redirect the browser to Google
      window.location.href = res.data.url;
    } catch (e) {
      console.error("Google Auth Error", e);
      alert("Could not connect to Google.");
    }
  };
  // Event Logic
  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title) return;
    try {
      // Send user.id in the body
      const res = await axios.post(`${API_BASE}/events`, {
        ...newEvent,
        user_id: user.id, // <--- ADDED
      });
      setEvents([res.data, ...events]);
      setNewEvent({ title: "", date: "", type: "Work" });
      setShowEventForm(false);
    } catch (e) {
      console.error(e);
    }
  };
  const handleDeleteEvent = async (id) => {
    try {
      await axios.delete(`${API_BASE}/events/${id}`);
      setEvents(events.filter((e) => e._id !== id));
    } catch (e) {}
  };

  // Sorting
  const getPriorityWeight = (p) => {
    if (p === "High") return 3;
    if (p === "Medium") return 2;
    return 1;
  };
  const sortNotes = (data) => {
    if (!sortByPriority) return data;
    return [...data].sort(
      (a, b) =>
        getPriorityWeight(b.final_priority) -
        getPriorityWeight(a.final_priority)
    );
  };
  const getPriorityColor = (p) => {
    if (p === "High") return "border-l-4 border-l-red-500";
    if (p === "Medium") return "border-l-4 border-l-blue-400";
    return "border-l-4 border-l-stone-300";
  };

  const insights = cards.filter((card) => card.type === "ai_insight");
  const dailyNotes = cards.filter(
    (card) =>
      card.type === "user_note" &&
      (card.ai_metadata.dashboard === mode ||
        card.ai_metadata.dashboard === "Both")
  );

  // --- RENDER: LOGIN SCREEN ---
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <LayoutDashboard className="text-white" size={24} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Welcome to Shadow
          </h1>
          <p className="text-slate-400 text-center mb-8 text-sm">
            Your context-aware AI workspace.
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                required
              />
            </div>

            {/* NEW SIGNUP FIELDS */}
            <AnimatePresence>
              {authMode === "signup" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-4 overflow-hidden pt-2"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={profile.name}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Age"
                      value={profile.age}
                      onChange={(e) =>
                        setProfile({ ...profile, age: e.target.value })
                      }
                      className="w-20 bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Gender"
                      value={profile.gender}
                      onChange={(e) =>
                        setProfile({ ...profile, gender: e.target.value })
                      }
                      className="w-1/3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Profession"
                      value={profile.profession}
                      onChange={(e) =>
                        setProfile({ ...profile, profession: e.target.value })
                      }
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Main Focus for this Month"
                    value={profile.current_focus}
                    onChange={(e) =>
                      setProfile({ ...profile, current_focus: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                    required
                  />

                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase font-bold ml-1">
                      Shadow Personality
                    </label>
                    <select
                      value={profile.shadow_type}
                      onChange={(e) =>
                        setProfile({ ...profile, shadow_type: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="Career Mode">👔 Career Mode</option>
                      <option value="Zen Mode">🧘 Zen Mode</option>
                      <option value="Witty Companion">
                        😜 Witty Companion
                      </option>
                      <option value="Drill Sergeant">🪖 Drill Sergeant</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {authError && (
              <p className="text-red-400 text-sm text-center">{authError}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : authMode === "login" ? (
                "Enter Shadow"
              ) : (
                "Create Account"
              )}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
              className="text-slate-500 hover:text-white text-sm transition-colors"
            >
              {authMode === "login"
                ? "New here? Create an account"
                : "Already have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: DASHBOARD ---
  return (
    <div
      className={`min-h-screen transition-colors duration-500 flex flex-col ${theme}`}
    >
      {/* HEADER */}
      <header className="p-4 border-b border-white/5 sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentColor}`}
            >
              <LayoutDashboard size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Shadow</h1>
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

      {/* MAIN DASHBOARD */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}
        <section className="lg:col-span-5 space-y-6">
          {/* --- QUICK NOTES SECTION --- */}
          <div className={`rounded-2xl border ${panelColor} overflow-hidden`}>
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/5 dark:bg-white/5">
              <span className="text-xs font-bold uppercase tracking-wider opacity-50">
                Quick Notes (AI)
              </span>
              <button
                onClick={() =>
                  setEditingNoteId(editingNoteId === "NEW" ? null : "NEW")
                }
                className="p-1 hover:bg-white/10 rounded"
                title="Add Note"
              >
                {editingNoteId === "NEW" ? <X size={16} /> : <Plus size={16} />}
              </button>
            </div>

            <div className="p-3 grid grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
              {/* 1. NEW NOTE FORM (Shows when + is clicked) */}
              <AnimatePresence>
                {editingNoteId === "NEW" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className={`col-span-2 p-3 rounded-lg border border-dashed border-blue-500/50 ${
                      mode === "Professional" ? "bg-blue-500/10" : "bg-blue-50"
                    }`}
                  >
                    <textarea
                      autoFocus
                      placeholder="Type your note here..."
                      value={tempNoteContent}
                      onChange={(e) => setTempNoteContent(e.target.value)}
                      className="w-full h-20 bg-transparent outline-none resize-none text-sm p-1 placeholder-opacity-50"
                    />
                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                      <select
                        value={tempNotePriority}
                        onChange={(e) => setTempNotePriority(e.target.value)}
                        className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                      >
                        <option className="text-black" value="High">
                          High 🔥
                        </option>
                        <option className="text-black" value="Medium">
                          Medium
                        </option>
                        <option className="text-black" value="Low">
                          Low
                        </option>
                        <option className="text-black" value="Auto">
                          Auto ✨
                        </option>
                      </select>
                      <button
                        onClick={async () => {
                          if (!tempNoteContent.trim()) return;
                          try {
                            const res = await axios.post(
                              `${API_BASE}/quick-notes`,
                              {
                                content: tempNoteContent,
                                priority: tempNotePriority,
                                user_id: user.id,
                              }
                            );
                            setQuickNotes([res.data, ...quickNotes]);
                            setEditingNoteId(null);
                            setTempNoteContent(""); // Reset
                            setTempNotePriority("Medium");
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md flex items-center gap-1"
                      >
                        Save <Check size={12} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 2. EXISTING NOTES LIST */}
              {sortNotes(quickNotes).map((note) => (
                <div
                  key={note._id}
                  className={`p-3 rounded-lg text-sm relative group cursor-pointer transition-all h-40 flex flex-col shadow-sm
                    ${
                      mode === "Professional"
                        ? "bg-slate-800 hover:bg-slate-700"
                        : "bg-white hover:bg-stone-50 border border-stone-100"
                    }
                    ${getPriorityColor(note.final_priority)}
                `}
                  onClick={() => {
                    if (editingNoteId !== "NEW") {
                      setEditingNoteId(note._id);
                      setTempNoteContent(note.content);
                      setTempNotePriority(note.priority || "Medium");
                    }
                  }}
                >
                  {editingNoteId === note._id ? (
                    // EDIT MODE (Existing Note)
                    <div className="h-full flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={tempNoteContent}
                        onChange={(e) => setTempNoteContent(e.target.value)}
                        className="w-full flex-1 bg-transparent outline-none resize-none text-sm p-1"
                      />
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <select
                          value={tempNotePriority}
                          onChange={(e) => setTempNotePriority(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent text-[10px] uppercase font-bold outline-none cursor-pointer"
                        >
                          <option className="text-black" value="High">
                            High 🔥
                          </option>
                          <option className="text-black" value="Medium">
                            Medium
                          </option>
                          <option className="text-black" value="Low">
                            Low
                          </option>
                          <option className="text-black" value="Auto">
                            Auto ✨
                          </option>
                        </select>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveQuickNote(note._id);
                          }}
                          className="p-1.5 bg-green-500/20 text-green-400 rounded-full hover:bg-green-500/30"
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // VIEW MODE
                    <>
                      <p className="whitespace-pre-wrap flex-1 overflow-hidden">
                        {note.content}
                      </p>
                      <div className="flex justify-between items-end mt-2">
                        <span className="text-[10px] uppercase font-bold opacity-30">
                          {note.final_priority}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuickNote(note._id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {quickNotes.length === 0 && editingNoteId !== "NEW" && (
                <div className="col-span-2 text-center py-8 opacity-40 text-sm">
                  Click + to add a sticky note
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-2xl border ${panelColor} overflow-hidden`}>
            <div className="p-4 border-b border-white/5 flex justify-between items-start bg-black/5 dark:bg-white/5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold opacity-80 flex items-center gap-2">
                  <Calendar size={18} /> UPCOMING EVENTS
                </h2>

                <div className="flex gap-2">
                  {/* NEW SYNC BUTTON */}
                  <button
                    onClick={handleGoogleSync}
                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all text-xs font-bold flex items-center gap-1"
                    title="Sync Google Calendar"
                  >
                    <RefreshCw size={14} /> Sync with Google
                  </button>

                  {/* <button
                    onClick={() => setShowEventForm(true)}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <Plus size={18} />
                  </button> */}
                </div>
              </div>
              <button
                onClick={() => setShowEventForm(!showEventForm)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <Plus size={18} />
              </button>
            </div>
            <AnimatePresence>
              {showEventForm && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddEvent}
                  className="p-4 border-b border-white/5 bg-black/20 dark:bg-white/5 space-y-3"
                >
                  <input
                    className="w-full bg-transparent border-b border-white/10 p-2 text-sm outline-none"
                    placeholder="Event Title..."
                    value={newEvent.title}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, title: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-transparent border-b border-white/10 p-2 text-sm outline-none"
                      placeholder="When?"
                      value={newEvent.date}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, date: e.target.value })
                      }
                    />
                    <select
                      className="bg-transparent border-b border-white/10 p-2 text-sm outline-none"
                      value={newEvent.type}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, type: e.target.value })
                      }
                    >
                      <option value="Work">Work</option>
                      <option value="Personal">Life</option>
                    </select>
                  </div>
                  <button
                    className={`w-full py-2 rounded-lg text-xs font-bold uppercase ${accentColor} text-white`}
                  >
                    Add Reminder
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
            <div className="p-2 space-y-1">
              {events.map((event) => (
                <div
                  key={event._id || i}
                  className="group relative pl-4 border-l-2 border-white/20 py-1"
                >
                  {/* Time Display */}
                  <div className="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-0.5 flex justify-between">
                    <span>{event.date}</span>
                    {/* NEW: Show Time if it exists */}
                    {event.time && (
                      <span
                        className={
                          event.time === "All Day"
                            ? "text-blue-400"
                            : "text-orange-400"
                        }
                      >
                        {event.time}
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium text-sm truncate">
                    {event.title}
                  </h4>

                  {/* Delete Button (Optional, for cleanup) */}
                  <button
                    onClick={() => handleDeleteEvent(event._id)}
                    className="absolute right-0 top-1 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {events.length === 0 && (
                <div className="p-6 text-center text-xs opacity-40">
                  No upcoming events.
                </div>
              )}
            </div>
          </div>

          {insights.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1">
                AI Insights
              </span>
              {insights.map((card) => (
                <div
                  key={card._id}
                  className="p-4 rounded-xl bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/30 text-sm leading-relaxed"
                >
                  <Sparkles
                    className="inline-block mr-2 text-purple-300"
                    size={14}
                  />
                  {card.raw_text}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RIGHT COLUMN */}
        <section className="lg:col-span-7 flex flex-col h-full relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-50">
              <History size={14} />
              <span>{mode} Timeline</span>
            </div>
            <button
              onClick={generateInsight}
              className="text-xs text-purple-400 hover:underline flex items-center gap-1"
            >
              <Sparkles size={12} /> Analyze Patterns
            </button>
          </div>
          <div className="space-y-4 pb-32">
            <AnimatePresence>
              {dailyNotes.map((card) => (
                <motion.div
                  key={card._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-xl border relative group transition-all ${panelColor}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2 flex-wrap">
                      {card.ai_metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                            mode === "Professional"
                              ? "bg-blue-500/20 text-blue-200"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {card.ai_metadata.is_venting && (
                      <span title="Venting">💨</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed mb-4 opacity-80 whitespace-pre-wrap">
                    {card.raw_text}
                  </p>
                  <div
                    className={`text-xs p-3 rounded-lg flex items-start gap-3 italic ${
                      mode === "Professional"
                        ? "bg-slate-800 text-blue-200"
                        : "bg-orange-50 text-orange-800"
                    }`}
                  >
                    <div
                      className={`w-1 h-1 mt-1.5 rounded-full ${
                        mode === "Professional"
                          ? "bg-blue-400"
                          : "bg-orange-400"
                      }`}
                    />
                    {card.ai_metadata.margin_note}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="fixed bottom-6 w-[inherit] z-10">
            <form
              onSubmit={handleSubmitNote}
              className="relative shadow-2xl rounded-2xl"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Log to ${mode} feed...`}
                className={`w-full p-4 pr-16 rounded-2xl outline-none border transition-all ${
                  mode === "Professional"
                    ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
                    : "bg-white border-stone-200 text-stone-800 placeholder-stone-400 focus:border-orange-400"
                }`}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className={`absolute right-2 top-2 bottom-2 aspect-square rounded-xl flex items-center justify-center transition-all ${accentColor} text-white`}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* CHAT OVERLAY */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`fixed bottom-24 right-6 w-80 md:w-96 h-[500px] shadow-2xl rounded-2xl flex flex-col overflow-hidden border z-50 backdrop-blur-xl ${
              mode === "Professional"
                ? "bg-slate-900/90 border-slate-700"
                : "bg-white/90 border-stone-200"
            }`}
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-purple-600 text-white">
              <div className="flex items-center gap-2">
                <Sparkles size={18} />
                <span className="font-bold">Chat with Shadow</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-white/20 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            {/* Inside the Chat Overlay div */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed 
    ${
      msg.isAlert
        ? "bg-orange-500/10 border border-orange-500 text-orange-600" // <--- ALERT STYLE
        : msg.role === "user"
        ? "bg-purple-600 text-white rounded-br-none"
        : mode === "Professional"
        ? "bg-slate-800 text-slate-200"
        : "bg-stone-200 text-stone-800"
    } rounded-bl-none`}
                  >
                    {msg.image && (
                      <img src={msg.image} alt="Upload" className="..." />
                    )}

                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div
                    className={`p-3 rounded-2xl rounded-bl-none ${
                      mode === "Professional" ? "bg-slate-800" : "bg-stone-200"
                    }`}
                  >
                    <Loader2 className="animate-spin opacity-50" size={18} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChatSubmit} className="relative">
              {/* PREVIEW: Show tiny thumbnail if image is selected */}
              {selectedImage && (
                <div className="absolute bottom-14 left-0 bg-black/80 p-2 rounded-lg border border-white/20">
                  <img
                    src={selectedImage}
                    alt="Upload"
                    className="h-16 w-16 object-cover rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              )}

              <div className="relative">
                {/* HIDDEN INPUT */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* TEXT INPUT */}
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    selectedImage ? "Add a caption..." : "Ask Shadow..."
                  }
                  className={`w-full p-4 pl-12 pr-12 rounded-xl outline-none border transition-all shadow-lg
                ${
                  mode === "Professional"
                    ? "bg-slate-800 border-slate-700 focus:border-blue-500 text-white placeholder-slate-500"
                    : "bg-white border-stone-200 focus:border-orange-400 text-stone-800 placeholder-stone-400"
                }`}
                />

                {/* IMAGE BUTTON (Left) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors
                ${
                  selectedImage
                    ? "text-blue-400"
                    : "opacity-50 hover:opacity-100"
                }`}
                >
                  <Camera size={20} />
                </button>

                {/* SEND BUTTON (Right) */}
                <button
                  type="submit"
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all
                ${
                  chatInput || selectedImage
                    ? mode === "Professional"
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "bg-orange-500 text-white hover:bg-orange-400"
                    : "opacity-0 pointer-events-none"
                }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 p-4 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg hover:scale-105 transition-all z-50 flex items-center gap-2"
      >
        {showChat ? <X size={24} /> : <MessageSquare size={24} />}
      </button>
    </div>
  );
}

export default App;
