import { useState } from "react";
import {
  Send,
  Sparkles,
  BrainCircuit,
  Flame,
  CheckCircle2,
  Lightbulb,
  Trash2,
  FileText,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../config";
import MarkdownView from "./MarkdownView";

const normalizeType = (rawType) => {
  if (!rawType) return "Activity";
  if (rawType === "Daily Recap") return "Daily Recap";

  const lower = rawType.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export default function Timeline({
  cards,
  setCards,
  user,
  panelColor,
  accentColor,
  showInsights, // <--- We use this prop for the logic below
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const [showRecap, setShowRecap] = useState(false);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapContent, setRecapContent] = useState("");

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    const tempId = Date.now().toString();
    const tempCard = {
      _id: tempId,
      raw_text: input,
      created_at: new Date().toISOString(),
      ai_metadata: {
        stream_type: "Activity",
        summary: "Processing...",
        impact_score: 0,
        ai_comment: "Shadow is analyzing...",
        tags: [],
      },
    };

    setCards([tempCard, ...cards]);
    setInput("");

    try {
      const res = await axios.post(`${API_BASE}/entries`, {
        user_id: user.id,
        raw_text: tempCard.raw_text,
      });
      setCards((prev) => prev.map((c) => (c._id === tempId ? res.data : c)));
    } catch (err) {
      console.error(err);
      setCards((prev) => prev.filter((c) => c._id !== tempId));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/entries/${id}`);
      setCards(cards.filter((c) => c._id !== id));
    } catch (e) {
      console.error("Failed to delete entry", e);
    }
  };

  const handleGenerateRecap = async () => {
    setShowRecap(true);
    setRecapLoading(true);
    setRecapContent("");

    try {
      const res = await axios.get(`${API_BASE}/insights/daily-recap`, {
        params: { user_id: user.id },
      });
      setRecapContent(res.data.recap);
    } catch (e) {
      setRecapContent("Failed to load recap.");
    } finally {
      setRecapLoading(false);
    }
  };

  // --- UPDATED FILTER LOGIC ---
  const filteredCards = cards.filter((card) => {
    const rawType = card.ai_metadata?.stream_type;
    const type = normalizeType(rawType);

    // 1. If Insights are OFF, HIDE Daily Recaps
    if (!showInsights && type === "Daily Recap") return false;

    // 2. Normal Category Filtering
    if (filter === "All") return true;
    return type === filter;
  });

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border ${panelColor} overflow-hidden relative`}
    >
      {/* 1. HEADER */}
      <div className="p-4 border-b border-white/5 bg-black/5 dark:bg-white/5 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h2 className="font-bold opacity-80 flex items-center gap-2 text-sm">
            <BrainCircuit size={16} /> DAILY STREAM
          </h2>

          {/* UPDATED BUTTON: Disabled style when Insights are off */}
          <button
            onClick={handleGenerateRecap}
            disabled={!showInsights}
            className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-2 py-1 rounded-md transition-all 
              ${
                showInsights
                  ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                  : "bg-white/5 text-gray-500 opacity-50 cursor-not-allowed"
              }`}
            title={
              !showInsights
                ? "Enable AI Insights to generate recap"
                : "Generate Daily Recap"
            }
          >
            <FileText size={12} /> Daily Recap
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {["All", "Activity", "Rant", "Idea"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filter === f
                  ? "bg-white text-black shadow-sm"
                  : "bg-white/5 hover:bg-white/10 opacity-60"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 2. LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {filteredCards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-xs text-center">
            <Sparkles size={32} className="mb-2" />
            <p>Your stream is empty.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredCards.map((card) => (
              <StreamCard
                key={card._id}
                card={card}
                onDelete={handleDelete}
                showInsights={showInsights}
                onOpenRecap={(content) => {
                  setRecapContent(content);
                  setShowRecap(true);
                }}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* 3. INPUT */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-white/5 bg-black/5 dark:bg-white/5 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Log an activity..."
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder-opacity-40"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={`p-2 rounded-lg transition-all ${
            input.trim() ? accentColor + " text-white" : "opacity-30"
          }`}
        >
          {loading ? (
            <Sparkles size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>

      {/* 4. RECAP MODAL */}
      <AnimatePresence>
        {showRecap && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 w-full max-w-md max-h-full flex flex-col rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                <h3 className="font-bold flex items-center gap-2 text-white">
                  <Sparkles size={16} className="text-purple-400" /> Daily
                  Analysis
                </h3>
                <button
                  onClick={() => setShowRecap(false)}
                  className="hover:bg-white/10 p-1 rounded-full transition-colors text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-slate-300 leading-relaxed">
                {recapLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-50">
                    <Sparkles size={32} className="animate-pulse" />
                    <p>Analyzing your day...</p>
                  </div>
                ) : (
                  <MarkdownView content={recapContent} />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- STREAM CARD ---
function StreamCard({ card, onDelete, showInsights, onOpenRecap }) {
  const meta = card.ai_metadata || {};
  const type = normalizeType(meta.stream_type);

  const styleMap = {
    Activity: {
      border: "border-l-4 border-l-emerald-500",
      icon: <CheckCircle2 size={14} className="text-emerald-500" />,
      bg: "bg-emerald-500/5",
    },
    Rant: {
      border: "border-l-4 border-l-red-500",
      icon: <Flame size={14} className="text-red-500" />,
      bg: "bg-red-500/5",
    },
    Idea: {
      border: "border-l-4 border-l-yellow-500",
      icon: <Lightbulb size={14} className="text-yellow-500" />,
      bg: "bg-yellow-500/5",
    },
    "Daily Recap": {
      border: "border-l-4 border-l-purple-500",
      icon: <FileText size={14} className="text-purple-500" />,
      bg: "bg-purple-500/5",
    },
  };

  const activeStyle = styleMap[type] || styleMap.Activity;
  const isRecap = type === "Daily Recap";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => isRecap && onOpenRecap(meta.summary)}
      className={`relative p-3 rounded-lg border border-white/5 ${
        activeStyle.bg
      } ${activeStyle.border} group transition-all hover:border-white/10 ${
        isRecap ? "cursor-pointer hover:bg-purple-500/10" : ""
      }`}
    >
      <div className="flex justify-between items-center mb-1 opacity-60 text-[10px] uppercase font-bold tracking-wider">
        <div className="flex items-center gap-1.5">
          {activeStyle.icon}
          <span>{type}</span>
          {meta.impact_score > 0 && (
            <span className="bg-white/10 px-1.5 rounded text-[9px]">
              {isRecap ? "Score" : "Impact"}: {meta.impact_score}/10
            </span>
          )}
        </div>
        <span className="opacity-70">
          {new Date(card.created_at).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div
        className={`text-sm opacity-90 mb-2 whitespace-pre-wrap ${
          isRecap ? "line-clamp-3 italic" : ""
        }`}
      >
        {isRecap ? "Click to view full Daily Recap..." : card.raw_text}
      </div>

      {showInsights && meta.ai_comment && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-2 text-xs opacity-70 italic">
          <Sparkles size={12} className="mt-0.5 opacity-50 shrink-0" />
          <span>"{meta.ai_comment}"</span>
        </div>
      )}

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card._id);
          }}
          className="p-1.5 bg-white/10 hover:bg-red-500 hover:text-white rounded-md text-gray-400 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}
