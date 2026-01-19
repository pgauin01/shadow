import { useState } from "react";
import { Calendar, Plus, RefreshCw, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../config";

export default function UpcomingEvents({
  events,
  setEvents,
  user,
  panelColor,
  accentColor,
}) {
  const [showEventForm, setShowEventForm] = useState(false);
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
        ...newEvent,
        user_id: user.id,
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
    <div className={`rounded-2xl border ${panelColor} overflow-hidden`}>
      <div className="p-4 border-b border-white/5 flex justify-between items-start bg-black/5 dark:bg-white/5">
        <div className="flex justify-between items-center mb-0 w-full">
          <h2 className="font-bold opacity-80 flex items-center gap-2">
            <Calendar size={18} /> UPCOMING EVENTS
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleGoogleSync}
              className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all text-xs font-bold flex items-center gap-1"
            >
              <RefreshCw size={14} /> Sync
            </button>
            <button
              onClick={() => setShowEventForm(!showEventForm)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
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
            key={event._id}
            className="group relative pl-4 border-l-2 border-white/20 py-1"
          >
            <div className="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-0.5 flex justify-between">
              <span>{event.date}</span>
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
            <h4 className="font-medium text-sm truncate">{event.title}</h4>
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
  );
}
