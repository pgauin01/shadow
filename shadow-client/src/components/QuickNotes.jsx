import { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Trash2,
  Check,
  Bold,
  Italic,
  List,
  Heading1,
  Maximize2,
  Minimize2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../config";
import { getPriorityColor } from "../utils";
import MarkdownView from "./MarkdownView";

export default function QuickNotes({
  notes,
  setNotes,
  user,
  mode,
  sortByPriority,
  panelColor,
}) {
  // --- 1. DYNAMIC WORKSPACES STATE ---
  // Default to ONLY "Main" as requested
  const [workspaces, setWorkspaces] = useState(
    user?.profile?.workspaces || user?.workspaces || ["Main"],
  );
  const [activeWorkspace, setActiveWorkspace] = useState("Main");
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [tempNoteContent, setTempNoteContent] = useState("");
  const [tempNotePriority, setTempNotePriority] = useState("Medium");
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    workspace: null,
  });

  console.log("workspaces", user, workspaces);

  const scrollContainerRef = useRef(null);

  // --- WORKSPACE CRUD OPERATIONS ---
  const saveWorkspacesToBackend = async (newList) => {
    try {
      setWorkspaces(newList);
      await axios.put(`${API_BASE}/users/${user.id}/workspaces`, {
        workspaces: newList,
      });
    } catch (e) {
      console.error("Failed to save workspaces", e);
    }
  };

  useEffect(() => {
    // Check both locations (depending on how App.jsx saves the user)
    const saved = user?.profile?.workspaces || user?.workspaces;

    // Only update if we actually found saved workspaces
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setWorkspaces(saved);

      // Optional: If the active workspace isn't in the new list, reset to Main
      if (!saved.includes(activeWorkspace)) {
        setActiveWorkspace("Main");
      }
    }
  }, [user]);

  const handleAddWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    const trimmedName = newWorkspaceName.trim();
    if (!workspaces.includes(trimmedName)) {
      const newList = [...workspaces, trimmedName];
      await saveWorkspacesToBackend(newList);
      setActiveWorkspace(trimmedName);
    }

    setNewWorkspaceName("");
    setIsAddingWorkspace(false);
  };

  const handleDeleteWorkspace = async (wsName) => {
    if (wsName === "Main") return;
    setDeleteConfirmation({ isOpen: true, workspace: wsName });
  };

  // 2. ACTUALLY DELETE (Run this when user clicks "Delete" in pop-up)
  const executeDeleteWorkspace = async () => {
    const wsName = deleteConfirmation.workspace;
    if (!wsName) return;

    try {
      console.log("Deleting workspace:", wsName); // Debug

      // Axios automatically handles the ?user_id=...&workspace=... syntax here
      await axios.delete(`${API_BASE}/quick-notes/workspace`, {
        params: {
          user_id: user.id || user._id,
          workspace: wsName,
        },
      });
      // B. Remove from Workspace List
      const newList = workspaces.filter((w) => w !== wsName);
      await saveWorkspacesToBackend(newList);

      // C. Update UI
      setActiveWorkspace("Main");
      setNotes((prev) => prev.filter((n) => n.workspace !== wsName));

      // D. Close Pop-up
      setDeleteConfirmation({ isOpen: false, workspace: null });
    } catch (e) {
      console.error("Failed to delete workspace", e);
      alert("Error deleting workspace.");
    }
  };

  // --- SCROLL LOGIC ---
  useEffect(() => {
    if (editingNoteId) {
      if (editingNoteId === "NEW") {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setTimeout(() => {
          const element = document.getElementById(`note-card-${editingNoteId}`);
          if (element) {
            element.scrollIntoView({
              behavior: "smooth",
              block: "start",
              inline: "nearest",
            });
          }
        }, 350);
      }
    }
  }, [editingNoteId]);

  // --- AUTO-SAVE LOGIC ---
  useEffect(() => {
    if (editingNoteId) {
      const storageKey =
        editingNoteId === "NEW"
          ? "shadow_draft_new"
          : `shadow_draft_${editingNoteId}`;
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft && savedDraft !== tempNoteContent) {
        setTempNoteContent(savedDraft);
      }
    }
  }, [editingNoteId]);

  useEffect(() => {
    if (!editingNoteId || !tempNoteContent) return;
    const timer = setTimeout(() => {
      const storageKey =
        editingNoteId === "NEW"
          ? "shadow_draft_new"
          : `shadow_draft_${editingNoteId}`;
      localStorage.setItem(storageKey, tempNoteContent);
      setLastSaved(new Date());
    }, 1000);
    return () => clearTimeout(timer);
  }, [tempNoteContent, editingNoteId]);

  const handleDiscardDraft = () => {
    const storageKey =
      editingNoteId === "NEW"
        ? "shadow_draft_new"
        : `shadow_draft_${editingNoteId}`;
    localStorage.removeItem(storageKey);
    setLastSaved(null);

    if (editingNoteId === "NEW") {
      setTempNoteContent("");
    } else {
      const originalNote = notes.find((n) => n._id === editingNoteId);
      if (originalNote) {
        setTempNoteContent(originalNote.content);
      }
    }
  };

  const handleCloseEditor = (e) => {
    if (e) e.stopPropagation();
    setEditingNoteId(null);
    setIsExpanded(false);
  };

  // --- ACTIONS ---
  const getPriorityWeight = (p) => {
    if (p === "High") return 3;
    if (p === "Medium") return 2;
    return 1;
  };

  // FILTER BY WORKSPACE
  const sortedNotes = sortByPriority
    ? [...notes]
        .filter((n) => (n.workspace || "Main") === activeWorkspace)
        .sort(
          (a, b) =>
            getPriorityWeight(b.final_priority) -
            getPriorityWeight(a.final_priority),
        )
    : notes.filter((n) => (n.workspace || "Main") === activeWorkspace);

  const handleSaveQuickNote = async (id) => {
    try {
      const optimisticPriority =
        tempNotePriority === "Auto" ? "Medium" : tempNotePriority;
      const updatedList = notes.map((n) =>
        n._id === id
          ? {
              ...n,
              content: tempNoteContent,
              priority: tempNotePriority,
              final_priority: optimisticPriority,
              workspace: activeWorkspace,
            }
          : n,
      );
      setNotes(updatedList);
      setEditingNoteId(null);
      setIsExpanded(false);
      localStorage.removeItem(`shadow_draft_${id}`);

      const res = await axios.put(`${API_BASE}/quick-notes/${id}`, {
        content: tempNoteContent,
        priority: tempNotePriority,
        workspace: activeWorkspace,
      });
      setNotes((current) => current.map((n) => (n._id === id ? res.data : n)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNote = async () => {
    if (!tempNoteContent.trim()) return;

    // 👇 Safety check: Ensure we have a valid ID
    const userId = user.id || user._id;
    if (!userId) {
      alert("User ID missing. Please refresh the page.");
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/quick-notes`, {
        content: tempNoteContent,
        priority: tempNotePriority,
        user_id: user.id,
        workspace: activeWorkspace,
      });
      setNotes([res.data, ...notes]);
      setEditingNoteId(null);
      setTempNoteContent("");
      setIsExpanded(false);
      localStorage.removeItem("shadow_draft_new");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/quick-notes/${id}`);
      setNotes(notes.filter((n) => n._id !== id));
      localStorage.removeItem(`shadow_draft_${id}`);
    } catch (e) {}
  };

  const insertFormat = (syntax) => {
    const textarea = document.getElementById("quick-note-active-input");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = tempNoteContent;
    let newText = text;
    let cursorOffset = 0;
    switch (syntax) {
      case "bold":
        newText =
          text.slice(0, start) +
          "**" +
          text.slice(start, end) +
          "**" +
          text.slice(end);
        cursorOffset = 2;
        break;
      case "italic":
        newText =
          text.slice(0, start) +
          "*" +
          text.slice(start, end) +
          "*" +
          text.slice(end);
        cursorOffset = 1;
        break;
      case "list":
        const prefix = start > 0 && text[start - 1] !== "\n" ? "\n- " : "- ";
        newText =
          text.slice(0, start) +
          prefix +
          text.slice(start, end) +
          text.slice(end);
        cursorOffset = prefix.length;
        break;
      case "heading":
        const hPrefix = start > 0 && text[start - 1] !== "\n" ? "\n# " : "# ";
        newText =
          text.slice(0, start) +
          hPrefix +
          text.slice(start, end) +
          text.slice(end);
        cursorOffset = hPrefix.length;
        break;
      default:
        return;
    }
    setTempNoteContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, end + cursorOffset);
    }, 0);
  };

  const FormatToolbar = () => (
    <div
      className={`flex items-center gap-1 p-2 border-b ${
        mode === "Professional" ? "border-white/10" : "border-stone-200"
      }`}
    >
      <button
        onClick={() => insertFormat("heading")}
        className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100"
        title="Heading"
      >
        <Heading1 size={14} />
      </button>
      <button
        onClick={() => insertFormat("bold")}
        className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100"
        title="Bold"
      >
        <Bold size={14} />
      </button>
      <button
        onClick={() => insertFormat("italic")}
        className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100"
        title="Italic"
      >
        <Italic size={14} />
      </button>
      <button
        onClick={() => insertFormat("list")}
        className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100"
        title="List"
      >
        <List size={14} />
      </button>
      <button
        onClick={handleDiscardDraft}
        className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded opacity-60 hover:opacity-100 ml-2 border-l border-white/10 pl-2"
        title="Discard Unsaved Changes"
      >
        <RotateCcw size={14} />
      </button>
      {lastSaved && (
        <span className="text-[10px] opacity-40 ml-2 animate-pulse">
          Saved locally
        </span>
      )}
      <div className="flex-1" />
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100 text-blue-400"
        title={isExpanded ? "Minimize" : "Expand"}
      >
        {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );

  return (
    <>
      <div
        className={`rounded-2xl border ${panelColor} overflow-hidden h-full flex flex-col`}
      >
        {/* HEADER */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/5 dark:bg-white/5 flex-shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider opacity-50">
            Active Notes & Drafts
          </span>
          <button
            onClick={() =>
              setEditingNoteId(editingNoteId === "NEW" ? null : "NEW")
            }
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Create New Note"
          >
            {editingNoteId === "NEW" ? <X size={20} /> : <Plus size={20} />}
          </button>
        </div>

        {/* DYNAMIC WORKSPACE TABS */}
        <div className="flex px-4 pt-2 gap-2 border-b border-white/5 bg-black/5 overflow-x-auto no-scrollbar items-center">
          {workspaces.map((ws) => (
            <div key={ws} className="relative group flex items-center">
              <button
                onClick={() => setActiveWorkspace(ws)}
                className={`pb-2 px-3 text-xs font-bold uppercase tracking-wider transition-colors relative whitespace-nowrap ${
                  activeWorkspace === ws
                    ? "text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {ws}
                {activeWorkspace === ws && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                  />
                )}
              </button>

              {/* Delete Button (Only shows on hover for non-Main tabs) */}
              {ws !== "Main" && activeWorkspace === ws && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteWorkspace(ws); // 👈 UPDATED
                  }}
                  className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:scale-110 transition-all z-10"
                  title="Delete Workspace"
                >
                  <X size={8} />
                </button>
              )}
            </div>
          ))}

          {/* ADD NEW WORKSPACE BUTTON */}
          {/* UPDATED: Added 'mb-2' to form and button to align with tabs baseline */}
          {isAddingWorkspace ? (
            <form
              onSubmit={handleAddWorkspace}
              className="flex items-center pb-1 mb-2"
            >
              <input
                autoFocus
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Name..."
                className="w-20 bg-transparent border-b border-blue-500 text-xs text-white outline-none pb-1 ml-2"
                onBlur={() => setIsAddingWorkspace(false)}
              />
            </form>
          ) : (
            <button
              onClick={() => setIsAddingWorkspace(true)}
              className="ml-1 p-1 mb-2 hover:bg-white/10 rounded-md text-gray-500 hover:text-blue-400 transition-colors"
              title="Add Workspace"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {/* NOTES GRID */}
        <div
          ref={scrollContainerRef}
          className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto custom-scrollbar content-start"
        >
          <AnimatePresence>
            {/* NEW NOTE FORM */}
            {editingNoteId === "NEW" && !isExpanded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className={`col-span-full rounded-xl border border-dashed border-blue-500/50 overflow-hidden flex flex-col min-h-[500px] shadow-lg ${
                  mode === "Professional" ? "bg-blue-500/10" : "bg-blue-50"
                }`}
              >
                <FormatToolbar />
                <textarea
                  id="quick-note-active-input"
                  autoFocus
                  placeholder={`Type your note for '${activeWorkspace}' here...`}
                  value={tempNoteContent}
                  onChange={(e) => setTempNoteContent(e.target.value)}
                  className="w-full flex-1 bg-transparent outline-none resize-none text-sm p-4 placeholder-opacity-50 font-mono leading-relaxed"
                />
                <div className="flex justify-between items-center p-2 border-t border-white/10 bg-black/5">
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
                  <div className="flex gap-2">
                    <button
                      onClick={handleCloseEditor}
                      className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-md"
                    >
                      Save <Check size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* NOTES LIST */}
          {sortedNotes.map((note) => (
            <div
              key={note._id}
              id={`note-card-${note._id}`}
              onClick={() => {
                if (editingNoteId !== "NEW") {
                  setEditingNoteId(note._id);
                  setTempNoteContent(note.content);
                  setTempNotePriority(note.priority || "Medium");
                }
              }}
              className={`p-4 rounded-xl text-sm relative group cursor-pointer transition-all flex flex-col shadow-sm border border-transparent hover:border-white/10 hover:shadow-md 
                ${
                  editingNoteId === note._id && !isExpanded
                    ? "col-span-full min-h-[500px] cursor-auto"
                    : "min-h-[180px]"
                }
                ${
                  mode === "Professional"
                    ? "bg-slate-800 hover:bg-slate-750"
                    : "bg-white hover:bg-stone-50 border-stone-200"
                }
                ${getPriorityColor(note.final_priority)}`}
            >
              {editingNoteId === note._id && !isExpanded ? (
                // IN-PLACE EDITOR
                <div className="h-full flex flex-col -m-2">
                  <div className="mb-1">
                    <FormatToolbar />
                  </div>
                  <textarea
                    id="quick-note-active-input"
                    autoFocus
                    value={tempNoteContent}
                    onChange={(e) => setTempNoteContent(e.target.value)}
                    className="w-full flex-1 bg-transparent outline-none resize-none text-sm p-4 font-mono leading-relaxed"
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

                    <div className="flex gap-2">
                      <button
                        onClick={handleCloseEditor}
                        className="p-1.5 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20"
                        title="Close (Don't Save)"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveQuickNote(note._id);
                        }}
                        className="p-1.5 bg-green-500/20 text-green-400 rounded-full hover:bg-green-500/30"
                        title="Save"
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // VIEW MODE
                <>
                  <div className="flex-1 overflow-hidden pointer-events-none">
                    <MarkdownView
                      content={note.content}
                      className="text-xs leading-relaxed line-clamp-6 opacity-90"
                    />
                  </div>
                  <div className="flex justify-between items-end mt-3 pt-3 border-t border-white/5">
                    <span className="text-[10px] uppercase font-bold opacity-30 tracking-wider">
                      {note.final_priority} Priority
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(note._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded transition-all"
                      title="Delete Note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {sortedNotes.length === 0 && editingNoteId !== "NEW" && (
            <div className="col-span-full flex flex-col items-center justify-center h-64 opacity-20 text-center">
              <List size={48} className="mb-4" />
              <p>
                No notes in <strong>{activeWorkspace}</strong>.
              </p>
              <p className="text-xs mt-2">Click + to start writing.</p>
            </div>
          )}
        </div>
      </div>

      {/* FULL SCREEN MODAL */}
      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col border overflow-hidden ${
                mode === "Professional"
                  ? "bg-slate-900 border-slate-700"
                  : "bg-white border-stone-200"
              }`}
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/10">
                <h3 className="font-bold flex items-center gap-2 text-lg">
                  {editingNoteId === "NEW" ? (
                    <Plus size={20} className="text-blue-400" />
                  ) : (
                    <Check size={20} className="text-green-400" />
                  )}
                  {editingNoteId === "NEW" ? "New Note" : "Editing Note"}
                  <span className="text-xs font-normal opacity-50 ml-2 py-1 px-2 rounded-full bg-white/5">
                    {activeWorkspace}
                  </span>
                </h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Minimize2 size={20} />
                </button>
              </div>

              <div
                className={`px-4 py-2 ${
                  mode === "Professional" ? "bg-slate-800" : "bg-stone-50"
                }`}
              >
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => insertFormat("heading")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100"
                  >
                    <Heading1 size={16} /> Heading
                  </button>
                  <button
                    onClick={() => insertFormat("bold")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100"
                  >
                    <Bold size={16} /> Bold
                  </button>
                  <button
                    onClick={() => insertFormat("italic")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100"
                  >
                    <Italic size={16} /> Italic
                  </button>
                  <button
                    onClick={() => insertFormat("list")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100"
                  >
                    <List size={16} /> List
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100 ml-auto"
                  >
                    <RotateCcw size={16} /> Reset
                  </button>
                  {lastSaved && (
                    <span className="text-[10px] opacity-40 ml-2 animate-pulse">
                      Saved
                    </span>
                  )}
                </div>
              </div>

              <textarea
                id="quick-note-active-input"
                autoFocus
                value={tempNoteContent}
                onChange={(e) => setTempNoteContent(e.target.value)}
                placeholder="Write your thoughts..."
                className={`flex-1 p-8 text-lg bg-transparent outline-none resize-none leading-relaxed font-mono ${
                  mode === "Professional"
                    ? "text-slate-200 placeholder-slate-600"
                    : "text-stone-800 placeholder-stone-400"
                }`}
              />

              <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase opacity-50">
                    Priority:
                  </span>
                  <select
                    value={tempNotePriority}
                    onChange={(e) => setTempNotePriority(e.target.value)}
                    className="bg-transparent text-sm font-bold outline-none cursor-pointer border rounded px-3 py-1.5 border-white/20"
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
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors opacity-70 hover:opacity-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      editingNoteId === "NEW"
                        ? handleAddNote()
                        : handleSaveQuickNote(editingNoteId)
                    }
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                  >
                    <Check size={18} /> Save Note
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-stone-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                  <AlertTriangle size={24} />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  Delete "{deleteConfirmation.workspace}"?
                </h3>

                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  This action will{" "}
                  <strong className="text-red-400">
                    permanently delete all notes
                  </strong>{" "}
                  inside this workspace. This cannot be undone.
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() =>
                      setDeleteConfirmation({ isOpen: false, workspace: null })
                    }
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeDeleteWorkspace}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-900/20 transition-all active:scale-95"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
