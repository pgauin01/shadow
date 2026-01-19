import { useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  History,
  Sparkles,
  Trash2,
  Lightbulb,
} from "lucide-react";
import { API_BASE } from "../config";
import MarkdownView from "./MarkdownView";

export default function Timeline({
  cards,
  setCards,
  user,
  mode,
  panelColor,
  accentColor,
  isSidebarOpen,
  showInsights, // <--- 1. Receive the prop
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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
      console.error("Failed to add note", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    try {
      setCards(cards.filter((c) => c._id !== id));
      await axios.delete(`${API_BASE}/entries/${id}`);
    } catch (e) {}
  };

  const generateInsight = async () => {
    if (analyzing || !showInsights) return; // Guard clause
    setAnalyzing(true);

    try {
      await axios.post(`${API_BASE}/insights/generate`, null, {
        params: { user_id: user.id },
      });
      // Success! Reload to show the new card
      window.location.reload();
    } catch (e) {
      console.error(e);
      setAnalyzing(false);

      // --- NEW: Handle Rate Limit Error ---
      if (e.response && e.response.status === 429) {
        // Show the message from the backend ("Insight limit reached...")
        alert("⏳ " + e.response.data.detail);
      } else {
        // Handle other errors (like 500 server error)
        alert("⚠️ Something went wrong. Please try again later.");
      }
    }
  };

  // --- FILTER LOGIC ---
  const dailyNotes = cards.filter(
    (card) =>
      (card.type === "user_note" || card.type === "ai_insight") &&
      (card.ai_metadata?.dashboard === mode ||
        card.ai_metadata?.dashboard === "Both"),
  );

  return (
    <section
      className={`flex flex-col h-full relative transition-all duration-300 ${
        isSidebarOpen ? "block" : "hidden"
      }`}
    >
      {/* --- HEADER --- */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4 pt-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-50">
          <History size={14} />
          <span>
            {mode === "Professional" ? "Professional" : "Personal"} Timeline
          </span>
        </div>

        {/* --- ANALYZE BUTTON --- */}
        <button
          onClick={generateInsight}
          disabled={analyzing || !showInsights} // <--- 2. Disable if insights are off
          title={
            !showInsights
              ? "Turn on AI Insights to use this feature"
              : "Generate new insights"
          }
          className={`text-xs flex items-center gap-1 transition-all rounded px-2 py-1
                ${
                  !showInsights
                    ? "text-gray-400 opacity-30 cursor-not-allowed grayscale" // Style when OFF
                    : analyzing
                      ? "text-purple-400/50 cursor-not-allowed bg-purple-500/5"
                      : "text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                }
            `}
        >
          {analyzing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {analyzing ? "Analyzing Patterns..." : "Analyze Patterns"}
        </button>
      </div>

      {/* --- LIST --- */}
      <div
        className={`flex-1 overflow-y-auto pr-2 pb-4 space-y-4 scrollbar-thin 
        ${
          mode === "Professional"
            ? "[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent"
            : "[&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-track]:bg-transparent"
        }`}
      >
        <AnimatePresence mode="popLayout">
          {dailyNotes.map((card) => (
            <motion.div
              key={card._id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 rounded-xl border relative group transition-all 
                ${
                  card.type === "ai_insight"
                    ? mode === "Professional"
                      ? "bg-purple-900/20 border-purple-500/30"
                      : "bg-purple-50 border-purple-200"
                    : panelColor
                }`}
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2 flex-wrap">
                  {card.type === "ai_insight" && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500 text-white flex items-center gap-1">
                      <Lightbulb size={8} /> AI Insight
                    </span>
                  )}
                  {card.ai_metadata?.tags?.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        mode === "Professional"
                          ? "bg-blue-500/20 text-blue-200"
                          : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {card.ai_metadata?.is_venting && (
                    <span title="Venting">💨</span>
                  )}
                  <button
                    onClick={() => handleDeleteEntry(card._id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all text-gray-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Main Text */}
              <div className="text-sm leading-relaxed mb-3 opacity-90">
                <MarkdownView content={card.raw_text} className="text-sm" />
              </div>

              {/* Margin Note */}
              {card.ai_metadata?.margin_note && (
                <div
                  className={`text-[11px] p-2 rounded-lg flex items-start gap-2 italic ${
                    mode === "Professional"
                      ? "bg-slate-800 text-blue-200"
                      : "bg-orange-50 text-orange-800"
                  }`}
                >
                  <div
                    className={`w-1 h-1 mt-1.5 rounded-full ${
                      mode === "Professional" ? "bg-blue-400" : "bg-orange-400"
                    }`}
                  />
                  {card.ai_metadata.margin_note}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {dailyNotes.length === 0 && (
          <div className="text-center opacity-30 py-10 text-sm">
            No entries found in {mode} timeline.
          </div>
        )}
      </div>

      {/* INPUT FORM */}
      <div className="flex-shrink-0 pt-2 z-10 bg-transparent">
        <form
          onSubmit={handleSubmitNote}
          className="relative shadow-xl rounded-2xl"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Log to ${mode} feed...`}
            className={`w-full p-4 pr-12 rounded-2xl outline-none border transition-all ${
              mode === "Professional"
                ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
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
  );
}
