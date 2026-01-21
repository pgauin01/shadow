import { useState } from "react";
import {
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Briefcase,
  User,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../config";

export default function UpcomingEvents({
  events,
  setEvents,
  user,
  panelColor,
  accentColor,
  showEventForm,
  setShowEventForm,
}) {
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    type: "Work",
  });

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title) return;
    try {
      const res = await axios.post(`${API_BASE}/events`, {
        title: newEvent.title,
        date: newEvent.date,
        time: null,
        location: null,
        type: newEvent.type,
        user_id: user.id,
      });

      const updatedList = [res.data, ...events].sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      setEvents(updatedList);
      setNewEvent({ title: "", date: "", type: "Work" });
      setShowEventForm(false);
    } catch (e) {
      console.error("Failed to create event:", e.response?.data || e);
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await axios.delete(`${API_BASE}/events/${id}`);
      setEvents(events.filter((e) => e._id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleGoogleSync = async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/google`, {
        params: { user_id: user.id },
      });
      window.location.href = res.data.url;
    } catch (e) {
      alert("Could not connect to Google.");
    }
  };

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border ${panelColor} overflow-hidden`}
    >
      {/* HEADER */}
      <div className="flex-shrink-0 p-4 border-b border-white/5 flex justify-between items-center bg-black/5 dark:bg-white/5">
        <h2 className="font-bold opacity-80 flex items-center gap-2 text-sm">
          <Calendar size={16} /> UPCOMING
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleGoogleSync}
            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all text-xs font-bold flex items-center gap-1"
          >
            <RefreshCw size={14} /> Sync
          </button>
          <button
            onClick={() => setShowEventForm(true)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* EVENTS LIST */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-xs text-center">
            <Calendar size={32} className="mb-2" />
            <p>No upcoming events.</p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event._id}
              className="group relative p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                {/* --- FIXED: Added Time Display Here --- */}
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-60 bg-white/5 px-1.5 py-0.5 rounded">
                  <span>{event.date}</span>
                  {event.time && (
                    <>
                      <span className="opacity-50">•</span>
                      <span className="text-white opacity-90">
                        {event.time}
                      </span>
                    </>
                  )}
                </div>

                {event.type === "Personal" ? (
                  <User size={12} className="text-orange-400 opacity-70" />
                ) : (
                  <Briefcase size={12} className="text-blue-400 opacity-70" />
                )}
              </div>

              <h4 className="font-medium text-sm truncate pr-6">
                {event.title}
              </h4>

              <button
                onClick={() => handleDeleteEvent(event._id)}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* POPUP MODAL (FORM) */}
      <AnimatePresence>
        {showEventForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border ${panelColor} bg-slate-900`}
            >
              {/* Modal Header */}
              <div
                className={`p-4 text-white flex justify-between items-center ${accentColor}`}
              >
                <span className="font-bold flex items-center gap-2">
                  <Plus size={18} /> New Event
                </span>
                <button
                  onClick={() => setShowEventForm(false)}
                  className="hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* YOUR EXACT FORM CODE */}
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleAddEvent}
                className="p-4 border-b border-white/5 bg-black/20 dark:bg-white/5 space-y-3"
              >
                <input
                  className="w-full bg-transparent border-b border-white/10 p-2 text-sm outline-none text-white placeholder-white/50"
                  placeholder="Event Title..."
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  autoFocus
                />
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-transparent border-b border-white/10 p-2 text-sm outline-none text-white placeholder-white/50"
                    placeholder="When?"
                    value={newEvent.date}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, date: e.target.value })
                    }
                  />
                  <select
                    className="bg-transparent border-b border-white/10 p-2 text-sm outline-none text-white cursor-pointer"
                    value={newEvent.type}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, type: e.target.value })
                    }
                  >
                    <option className="bg-slate-800" value="Work">
                      Work
                    </option>
                    <option className="bg-slate-800" value="Personal">
                      Life
                    </option>
                  </select>
                </div>
                <button
                  className={`w-full py-2 rounded-lg text-xs font-bold uppercase ${accentColor} text-white`}
                >
                  Add Reminder
                </button>
              </motion.form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
