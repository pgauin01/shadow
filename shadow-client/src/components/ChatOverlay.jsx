import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Trash2,
  Minimize2,
  Maximize2,
  Terminal,
  Camera,
  Mic,
  MicOff,
} from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../config";
import MarkdownView from "./MarkdownView";

export default function ChatOverlay({
  user,
  chatHistory,
  setChatHistory,
  mode,
  handleGoogleSync,
  setIsSidebarOpen,
  setShowEventForm,
  onEventCreated,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  // --- AUTO-SCROLL ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isOpen, isMinimized]);

  // --- COMMAND HANDLING ---
  const handleCommand = (cmd) => {
    const command = cmd.toLowerCase().trim();

    if (command === "/clear") {
      setChatHistory([]);
      return "Chat cleared.";
    }
    if (command === "/sync") {
      handleGoogleSync();
      return "Syncing Google Calendar...";
    }
    if (command === "/zen") {
      setIsSidebarOpen((prev) => !prev);
      return "Toggled Zen Mode.";
    }
    if (command === "/event" || command === "/events") {
      setIsSidebarOpen(true);
      setShowEventForm(true);
      setIsOpen(false);
      return "Opening Event Form...";
    }
    return null;
  };

  // --- IMAGE HANDLING ---
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // --- SEND MESSAGE ---
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    // 1. Check Commands
    if (input.startsWith("/")) {
      const feedback = handleCommand(input);
      if (feedback) {
        setChatHistory((prev) => [
          ...prev,
          { role: "system", content: feedback },
        ]);
        setInput("");
        return;
      }
    }

    // 2. Optimistic UI Update
    const newMessage = {
      role: "user",
      content: input,
      image: selectedImage, // Store image in history locally
    };

    setChatHistory([...chatHistory, newMessage]);
    setInput("");
    setSelectedImage(null); // Clear image after sending
    setLoading(true);

    try {
      // 3. SEND TO BACKEND (Fixed Payload Structure)
      const res = await axios.post(`${API_BASE}/chat`, {
        user_id: user.id, // <--- Required by Backend
        message: newMessage.content, // <--- Required by Backend
        history: chatHistory, // <--- Required by Backend
        image: newMessage.image, // <--- Optional
      });

      const botMessage = {
        role: "model",
        content: res.data.response,
      };
      setChatHistory((prev) => [...prev, botMessage]);
      if (
        res.data.response.includes("✅") ||
        res.data.response.includes("scheduled")
      ) {
        console.log("📅 Event detected! Refreshing calendar...");
        if (onEventCreated) onEventCreated();
      }
    } catch (error) {
      console.error(error);
      setChatHistory((prev) => [
        ...prev,
        { role: "model", content: "⚠️ Error connecting to server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const showCommandHint = input.startsWith("/");

  const handleVoiceInput = () => {
    // 1. Browser Support Check
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice control requires Google Chrome or a supported browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true; // J.A.R.V.I.S. style typing
    recognition.lang = "en-US";

    // 2. Start Listening
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("Mic already active", err);
    }

    // 3. Handle Results
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join("");
      setInput(transcript);
    };

    // 4. Handle End (Stop animation)
    recognition.onend = () => setIsListening(false);

    // 5. Handle Errors Gracefully
    recognition.onerror = (event) => {
      console.error("Voice Error:", event.error);
      setIsListening(false);

      if (event.error === "network") {
        alert(
          "Network Error: Voice recognition failed. \n\nTip: This feature works best in Google Chrome. Brave/Edge may block Google's speech servers.",
        );
      } else if (event.error === "not-allowed") {
        alert("Microphone blocked. Please check your browser permissions.");
      }
    };
  };

  return (
    <>
      {/* FLOATING TOGGLE BUTTON */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl z-50 transition-transform hover:scale-110 flex items-center gap-2 ${
            mode === "Professional"
              ? "bg-blue-600 text-white"
              : "bg-orange-500 text-white"
          }`}
        >
          <MessageSquare size={24} />
          <span className="font-bold text-sm hidden md:block">Ask AI</span>
        </button>
      )}

      {/* CHAT WINDOW */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? "60px" : "500px",
              width: isMinimized
                ? "200px"
                : window.innerWidth < 768
                  ? "90vw"
                  : "380px",
            }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 right-4 lg:right-6 z-50 rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-all max-h-[80vh] ${
              mode === "Professional"
                ? "bg-slate-900 border-slate-700"
                : "bg-white border-stone-200"
            }`}
          >
            {/* HEADER */}
            <div
              className={`p-3 flex items-center justify-between cursor-pointer ${
                mode === "Professional" ? "bg-slate-800" : "bg-stone-100"
              }`}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    mode === "Professional" ? "bg-blue-400" : "bg-orange-400"
                  }`}
                />
                <span className="font-bold text-sm">
                  {isMinimized ? "Shadow AI" : `Chat (${mode})`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  className="p-1 hover:bg-black/10 rounded"
                >
                  {isMinimized ? (
                    <Maximize2 size={14} />
                  ) : (
                    <Minimize2 size={14} />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* CHAT BODY */}
            {!isMinimized && (
              <>
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/5 dark:bg-black/20"
                >
                  {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-90">
                      {/* 1. Icon & Greeting */}
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`p-4 rounded-2xl ${
                            mode === "Professional"
                              ? "bg-blue-600/20 text-blue-400"
                              : "bg-orange-500/20 text-orange-400"
                          }`}
                        >
                          <MessageSquare size={32} />
                        </div>
                        <h3 className="font-bold text-lg">
                          Hi {user?.name?.split(" ")[0] || "there"}!
                        </h3>
                      </div>

                      {/* 2. Updated Description */}
                      <div className="text-sm max-w-[280px] leading-relaxed text-gray-500 dark:text-gray-400">
                        <p>
                          I am here to help you{" "}
                          <strong>organize your life</strong>.
                        </p>
                        <p className="mt-2 text-xs opacity-70">
                          I can{" "}
                          <strong className="text-blue-400">
                            Schedule Events
                          </strong>{" "}
                          and{" "}
                          <strong className="text-purple-400">
                            Recall Memories
                          </strong>{" "}
                          from your past logs.
                        </p>
                      </div>

                      {/* 3. Clickable Starter Prompts */}
                      <div className="w-full max-w-[280px] grid gap-2">
                        {/* Button 1: Work Event */}
                        <button
                          onClick={() =>
                            setInput(
                              "Schedule a Work meeting regarding Project X for Tomorrow at 10 AM",
                            )
                          }
                          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs text-left transition-all group"
                        >
                          <span className="block font-bold mb-0.5 group-hover:text-blue-400 transition-colors">
                            📅 Schedule Work Event
                          </span>
                          <span className="opacity-50 truncate block">
                            "Meeting tomorrow at 10 AM..."
                          </span>
                        </button>

                        {/* Button 2: Personal Event */}
                        <button
                          onClick={() =>
                            setInput(
                              "Add a Personal event: Gym session on Saturday at 5 PM",
                            )
                          }
                          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs text-left transition-all group"
                        >
                          <span className="block font-bold mb-0.5 group-hover:text-orange-400 transition-colors">
                            🏃 Schedule Personal Event
                          </span>
                          <span className="opacity-50 truncate block">
                            "Gym on Saturday at 5 PM..."
                          </span>
                        </button>

                        {/* 👇 NEW Button 3: Recall Memory */}
                        <button
                          onClick={() => setInput("What were my recent ideas?")}
                          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs text-left transition-all group"
                        >
                          <span className="block font-bold mb-0.5 group-hover:text-purple-400 transition-colors">
                            🧠 Recall Ideas
                          </span>
                          <span className="opacity-50 truncate block">
                            "What were my recent ideas?"
                          </span>
                        </button>
                      </div>

                      {/* 4. Command Hint */}
                      <div className="text-[10px] opacity-40 font-mono flex gap-3">
                        <span>/clear</span> <span>/sync</span>
                        <span>/zen</span>
                        <span>/event</span>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                            msg.role === "user"
                              ? mode === "Professional"
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-orange-500 text-white rounded-br-none"
                              : mode === "Professional"
                                ? "bg-slate-800 text-slate-200 rounded-bl-none"
                                : "bg-white text-stone-800 border border-stone-200 rounded-bl-none"
                          } ${
                            msg.role === "system"
                              ? "w-full text-center bg-transparent border border-dashed border-white/20 text-xs opacity-70 shadow-none"
                              : ""
                          }`}
                        >
                          {msg.image && (
                            <img
                              src={msg.image}
                              alt="User Upload"
                              className="rounded-lg mb-2 max-h-32 object-cover"
                            />
                          )}
                          {msg.role === "system" ? (
                            <span>{msg.content}</span>
                          ) : (
                            <MarkdownView content={msg.content || msg.text} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 p-2 rounded-xl rounded-bl-none animate-pulse">
                        <Loader2 size={16} className="animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                {/* HINTS */}
                {showCommandHint && (
                  <div className="px-3 py-1 bg-black/20 backdrop-blur-sm border-t border-white/5 text-[10px] flex gap-3 text-blue-300 font-mono overflow-x-auto">
                    <span>/clear</span>
                    <span>/sync</span>
                    <span>/zen</span>
                    <span>/event</span>
                  </div>
                )}

                {/* IMAGE PREVIEW */}
                {selectedImage && (
                  <div className="absolute bottom-16 left-4 bg-black/80 p-2 rounded-lg border border-white/20 z-50">
                    <img
                      src={selectedImage}
                      alt="Upload Preview"
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

                {/* INPUT AREA */}
                <form
                  onSubmit={handleSend}
                  className={`p-3 border-t flex gap-2 ${
                    mode === "Professional"
                      ? "border-slate-700 bg-slate-900"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  {/* CAMERA BUTTON */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedImage
                        ? "text-blue-400 bg-blue-400/10"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/10"
                    }`}
                  >
                    <Camera size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className={`p-2 rounded-lg transition-all ${
                      isListening
                        ? "bg-red-500/20 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" // Glowing effect
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/10"
                    }`}
                    title="Toggle Voice Mode"
                  >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>

                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      selectedImage
                        ? "Add a caption..."
                        : "Type a message or / for commands..."
                    }
                    className="flex-1 bg-transparent outline-none text-sm placeholder-opacity-50 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={loading || (!input.trim() && !selectedImage)}
                    className={`p-2 rounded-lg transition-all ${
                      input.trim() || selectedImage
                        ? mode === "Professional"
                          ? "bg-blue-600 text-white"
                          : "bg-orange-500 text-white"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
