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
  Lock,
  Unlock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../config";
import { getPriorityColor } from "../utils";
import MarkdownView from "./MarkdownView";
import { deriveKey, encryptData, decryptData } from "../util/crypto";

export default function QuickNotes({
  notes,
  setNotes,
  user,
  mode,
  sortByPriority,
  panelColor,
  onRefresh,
}) {
  // --- 1. STATE ---
  // Workspaces
  const [workspaces, setWorkspaces] = useState(["Main"]);
  const [activeWorkspace, setActiveWorkspace] = useState("Main");
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    workspace: null,
  });

  // Note Editing
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [tempNoteContent, setTempNoteContent] = useState("");
  const [tempNotePriority, setTempNotePriority] = useState("Medium");
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Zero-Knowledge Vault
  const [isSecretMode, setIsSecretMode] = useState(false); // Toggle for new/editing note
  const [vaultKey, setVaultKey] = useState(null); // The generated crypto key
  const [vaultPassword, setVaultPassword] = useState(""); // Input field
  const [showVaultPrompt, setShowVaultPrompt] = useState(false);
  const [vaultError, setVaultError] = useState("");

  const scrollContainerRef = useRef(null);

  // --- 2. WORKSPACE LOGIC ---
  useEffect(() => {
    const saved = user?.profile?.workspaces || user?.workspaces;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setWorkspaces(saved);
      if (!saved.includes(activeWorkspace)) setActiveWorkspace("Main");
    }
  }, [user]);

  useEffect(() => {
    if (vaultKey && notes.length > 0) {
      const needsDecryption = notes.some((n) => n.is_encrypted && !n.decrypted);
      if (needsDecryption) {
        decryptAllNotes(vaultKey);
      }
    }
  }, [notes, vaultKey]);

  const saveWorkspacesToBackend = async (newList) => {
    try {
      setWorkspaces(newList);
      await axios.put(`${API_BASE}/users/${user.id || user._id}/workspaces`, {
        workspaces: newList,
      });
    } catch (e) {
      console.error("Failed to save workspaces", e);
    }
  };

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

  const initiateDeleteWorkspace = (wsName) => {
    if (wsName === "Main") return;
    setDeleteConfirmation({ isOpen: true, workspace: wsName });
  };

  const executeDeleteWorkspace = async () => {
    const wsName = deleteConfirmation.workspace;
    if (!wsName) return;

    try {
      await axios.delete(`${API_BASE}/quick-notes/workspace`, {
        params: {
          user_id: user.id || user._id,
          workspace: wsName,
        },
      });

      const newList = workspaces.filter((w) => w !== wsName);
      await saveWorkspacesToBackend(newList);

      setActiveWorkspace("Main");
      setNotes((prev) => prev.filter((n) => n.workspace !== wsName));
      setDeleteConfirmation({ isOpen: false, workspace: null });
    } catch (e) {
      console.error("Failed to delete workspace", e);
      alert("Error deleting workspace.");
    }
  };

  // --- 3. VAULT LOGIC ---
  const unlockVault = async (e) => {
    e.preventDefault();
    if (!vaultPassword) return;
    setVaultError(""); // Clear previous errors

    // 1. Derive the Candidate Key
    // (Ensure you pass the salt if you implemented the previous step, otherwise just password)
    const userSalt = user?.profile?.vault_salt;
    const candidateKey = await deriveKey(vaultPassword, userSalt);

    // 2. VERIFY: Test the key on an existing encrypted note
    const testNote = notes.find((n) => n.is_encrypted && !n.decrypted);

    if (testNote) {
      // Try to decrypt ONE note first
      const result = await decryptData(testNote.content, candidateKey);

      // Check if it returned the specific fallback string from crypto.js
      if (result === "🔒 [Encrypted Content]") {
        setVaultError("Incorrect Password. Please try again.");
        setVaultPassword(""); // Clear input
        return; // 🛑 STOP! Do not close the modal.
      }
    }

    // 3. Success! Key is valid.
    setVaultKey(candidateKey);
    setShowVaultPrompt(false);
    decryptAllNotes(candidateKey);
  };

  const decryptAllNotes = async (key) => {
    const decryptedList = await Promise.all(
      notes.map(async (n) => {
        if (n.is_encrypted && !n.decrypted) {
          const plain = await decryptData(n.content, key);
          return { ...n, content: plain, decrypted: true };
        }
        return n;
      }),
    );
    setNotes(decryptedList);
  };

  // --- 4. NOTE CRUD OPERATIONS ---
  const handleAddNote = async () => {
    if (!tempNoteContent.trim()) return;

    let finalContent = tempNoteContent;
    let isEncrypted = false;

    // Handle Encryption
    if (isSecretMode) {
      if (!vaultKey) {
        setShowVaultPrompt(true);
        return;
      }
      finalContent = await encryptData(tempNoteContent, vaultKey);
      isEncrypted = true;
    }

    try {
      // NOTE: Added trailing slash to match backend router
      const res = await axios.post(`${API_BASE}/quick-notes/`, {
        content: finalContent,
        priority: tempNotePriority,
        user_id: user.id || user._id,
        workspace: activeWorkspace,
        is_encrypted: isEncrypted,
      });

      // Display unencrypted version locally
      const displayNote = {
        ...res.data,
        content: tempNoteContent,
        decrypted: true,
      };
      setNotes([displayNote, ...notes]);
      onRefresh();
      setEditingNoteId(null);
      setTempNoteContent("");
      setIsSecretMode(false);
      localStorage.removeItem("shadow_draft_new");
    } catch (e) {
      console.error(e);
      alert("Failed to save note.");
    }
  };

  const handleSaveQuickNote = async (id) => {
    try {
      let finalContent = tempNoteContent;
      let finalIsEncrypted = isSecretMode; // User choice from toggle

      // 1. Re-Encrypt if Secret Mode is ON
      if (isSecretMode) {
        if (!vaultKey) {
          setShowVaultPrompt(true);
          return;
        }
        finalContent = await encryptData(tempNoteContent, vaultKey);
      }

      const optimisticPriority =
        tempNotePriority === "Auto" ? "Medium" : tempNotePriority;

      // 2. Optimistic Update
      const updatedList = notes.map((n) =>
        n._id === id
          ? {
              ...n,
              content: tempNoteContent, // Keep plain text for UI
              priority: tempNotePriority,
              final_priority: optimisticPriority,
              workspace: activeWorkspace,
              is_encrypted: finalIsEncrypted,
              decrypted: true,
            }
          : n,
      );
      setNotes(updatedList);
      setEditingNoteId(null);
      setIsExpanded(false);
      localStorage.removeItem(`shadow_draft_${id}`);

      // 3. Send to Backend
      const res = await axios.put(`${API_BASE}/quick-notes/${id}`, {
        content: finalContent, // Encrypted or Plain
        priority: tempNotePriority,
        workspace: activeWorkspace,
        is_encrypted: finalIsEncrypted,
      });

      // 4. Sync with Backend Response
      setNotes((current) =>
        current.map((n) =>
          n._id === id
            ? { ...res.data, content: tempNoteContent, decrypted: true }
            : n,
        ),
      );
      await onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to update note.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/quick-notes/${id}`);
      setNotes(notes.filter((n) => n._id !== id));
      onRefresh(); // 👈 Sync
      localStorage.removeItem(`shadow_draft_${id}`);
    } catch (e) {}
  };

  // --- 5. FORMATTING TOOLBAR ---
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

  // --- UPDATED TOOLBAR ---
  const FormatToolbar = (
    { compact = false }, // Accept 'compact' prop
  ) => (
    <div
      className={`flex items-center gap-1 p-2 border-b ${
        mode === "Professional" ? "border-white/10" : "border-stone-200"
      }`}
    >
      {/* ... Bold/Italic/List buttons ... */}
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

      {/* Only show List button if not super compact */}
      {!compact && (
        <button
          onClick={() => insertFormat("list")}
          className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100"
          title="List"
        >
          <List size={14} />
        </button>
      )}

      {/* Discard Button */}
      <button
        onClick={handleDiscardDraft}
        className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded opacity-60 hover:opacity-100 ml-1 border-l border-white/10 pl-1"
        title="Discard"
      >
        <RotateCcw size={14} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsSecretMode(!isSecretMode);
        }}
        className={`ml-1 p-1 rounded flex items-center gap-1 text-[10px] font-bold transition-all ${
          isSecretMode
            ? "bg-yellow-500/20 text-yellow-500"
            : "hover:bg-white/10 opacity-50"
        }`}
        title="Toggle Encryption"
      >
        {isSecretMode ? <Lock size={12} /> : <Unlock size={12} />}
        {/* Hide text in compact mode to save space */}
        {!compact && <span>{isSecretMode ? "Secret" : "Public"}</span>}
      </button>

      <div className="flex-1" />

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100 text-blue-400"
        title="Expand"
      >
        {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );

  // --- 6. AUTO-SAVE & SCROLL ---
  useEffect(() => {
    if (editingNoteId) {
      if (editingNoteId === "NEW") {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setTimeout(() => {
          const el = document.getElementById(`note-card-${editingNoteId}`);
          if (el)
            el.scrollIntoView({
              behavior: "smooth",
              block: "start",
              inline: "nearest",
            });
        }, 350);
      }
    }
  }, [editingNoteId]);

  useEffect(() => {
    if (editingNoteId) {
      const key =
        editingNoteId === "NEW"
          ? "shadow_draft_new"
          : `shadow_draft_${editingNoteId}`;
      const saved = localStorage.getItem(key);
      if (saved && saved !== tempNoteContent) setTempNoteContent(saved);
    }
  }, [editingNoteId]);

  useEffect(() => {
    if (!editingNoteId || !tempNoteContent) return;
    const timer = setTimeout(() => {
      const key =
        editingNoteId === "NEW"
          ? "shadow_draft_new"
          : `shadow_draft_${editingNoteId}`;
      localStorage.setItem(key, tempNoteContent);
      setLastSaved(new Date());
    }, 1000);
    return () => clearTimeout(timer);
  }, [tempNoteContent, editingNoteId]);

  const handleDiscardDraft = () => {
    const key =
      editingNoteId === "NEW"
        ? "shadow_draft_new"
        : `shadow_draft_${editingNoteId}`;
    localStorage.removeItem(key);
    setLastSaved(null);
    if (editingNoteId === "NEW") {
      setTempNoteContent("");
    } else {
      const original = notes.find((n) => n._id === editingNoteId);
      if (original) setTempNoteContent(original.content);
    }
  };

  const handleCloseEditor = (e) => {
    if (e) e.stopPropagation();
    setEditingNoteId(null);
    setIsExpanded(false);
  };

  // --- 7. RENDER HELPERS ---
  const getPriorityWeight = (p) => {
    if (p === "High") return 3;
    if (p === "Medium") return 2;
    return 1;
  };
  const sortedNotes = sortByPriority
    ? [...notes]
        .filter((n) => (n.workspace || "Main") === activeWorkspace)
        .sort(
          (a, b) =>
            getPriorityWeight(b.final_priority) -
            getPriorityWeight(a.final_priority),
        )
    : notes.filter((n) => (n.workspace || "Main") === activeWorkspace);

  return (
    <>
      <div
        className={`rounded-2xl border ${panelColor} overflow-hidden h-full flex flex-col`}
      >
        {/* HEADER */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/5 dark:bg-white/5 flex-shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider opacity-50">
            Active Notes
          </span>
          <button
            onClick={() => {
              setEditingNoteId(editingNoteId === "NEW" ? null : "NEW");
              setTempNoteContent("");
              setIsSecretMode(false);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {editingNoteId === "NEW" ? <X size={20} /> : <Plus size={20} />}
          </button>
        </div>

        {/* WORKSPACE TABS */}
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
              {ws !== "Main" && activeWorkspace === ws && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    initiateDeleteWorkspace(ws);
                  }}
                  className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:scale-110 transition-all z-10"
                >
                  <X size={8} />
                </button>
              )}
            </div>
          ))}
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
                  placeholder={`Type your note for '${activeWorkspace}'...`}
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
                      className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-lg"
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

          {/* VAULT MODAL */}
          <AnimatePresence>
            {showVaultPrompt && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="bg-stone-900 p-6 rounded-2xl border border-yellow-500/30 max-w-sm w-full text-center shadow-2xl"
                >
                  <Lock size={40} className="mx-auto text-yellow-500 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">
                    {notes.some((n) => n.is_encrypted)
                      ? "Unlock Shadow Vault"
                      : "Setup Vault Password"}
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    {notes.some((n) => n.is_encrypted)
                      ? "Enter your password to decrypt your notes."
                      : "Create a password. Do not lose it; there is no recovery."}
                  </p>
                  {vaultError && (
                    <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-xs font-bold animate-pulse">
                      {vaultError}
                    </div>
                  )}
                  <form onSubmit={unlockVault}>
                    <input
                      type="password"
                      autoFocus
                      placeholder={
                        notes.some((n) => n.is_encrypted)
                          ? "Vault Password..."
                          : "New Password..."
                      }
                      value={vaultPassword}
                      onChange={(e) => setVaultPassword(e.target.value)}
                      className="w-full p-3 rounded-lg bg-black/50 border border-white/10 text-white outline-none focus:border-yellow-500 mb-4 focus:ring-1 focus:ring-yellow-500"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg"
                    >
                      {notes.some((n) => n.is_encrypted)
                        ? "Unlock Vault"
                        : "Set Password & Encrypt"}
                    </button>
                  </form>
                  <button
                    onClick={() => {
                      setShowVaultPrompt(false);
                      setIsSecretMode(false);
                    }}
                    className="mt-4 text-xs text-gray-500 hover:text-gray-300 underline"
                  >
                    Cancel
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* NOTES LIST */}
          {sortedNotes.map((note) => (
            <div
              key={note._id}
              id={`note-card-${note._id}`}
              onClick={() => {
                if (editingNoteId !== "NEW") {
                  // Intercept Click if Encrypted & Locked
                  if (note.is_encrypted && !note.decrypted) {
                    setShowVaultPrompt(true);
                    return;
                  }
                  setEditingNoteId(note._id);
                  setTempNoteContent(note.content);
                  setTempNotePriority(note.priority || "Medium");
                  setIsSecretMode(note.is_encrypted || false); // Sync Toggle
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
                  <div className="flex-1 overflow-hidden pointer-events-none relative">
                    {/* 👇 NEW: Visual Indicator for Decrypted Notes */}
                    {note.is_encrypted && note.decrypted && (
                      <div
                        className="absolute top-0 right-0 z-10 bg-yellow-500/10 text-yellow-500 p-1 rounded-bl-lg rounded-tr-lg backdrop-blur-sm"
                        title="Encrypted (Unlocked)"
                      >
                        <Lock size={12} strokeWidth={3} />
                      </div>
                    )}

                    {/* Encrypted Placeholder vs Content */}
                    {note.is_encrypted && !note.decrypted ? (
                      <div className="flex flex-col items-center justify-center h-full text-stone-500 opacity-50">
                        <Lock size={24} className="mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">
                          Encrypted
                        </span>
                      </div>
                    ) : (
                      <MarkdownView
                        content={note.content}
                        className="text-xs leading-relaxed line-clamp-6 opacity-90"
                      />
                    )}
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

      {/* DELETE WORKSPACE CONFIRMATION */}
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
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeDeleteWorkspace}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXPANDED MODAL (FULL SCREEN) */}
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
                </h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-white/10 rounded-full"
                >
                  <Minimize2 size={20} />
                </button>
              </div>

              {/* TOOLBAR FOR MODAL */}
              <div className="px-4 py-2 border-b border-white/5 bg-black/5">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => insertFormat("heading")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase opacity-70 hover:opacity-100"
                  >
                    <Heading1 size={16} /> Heading
                  </button>
                  <button
                    onClick={() => insertFormat("bold")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase opacity-70 hover:opacity-100"
                  >
                    <Bold size={16} /> Bold
                  </button>
                  <button
                    onClick={() => insertFormat("italic")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase opacity-70 hover:opacity-100"
                  >
                    <Italic size={16} /> Italic
                  </button>
                  <button
                    onClick={() => insertFormat("list")}
                    className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold uppercase opacity-70 hover:opacity-100"
                  >
                    <List size={16} /> List
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded flex items-center gap-2 text-xs font-bold uppercase opacity-70 hover:opacity-100 ml-auto"
                  >
                    <RotateCcw size={16} /> Reset
                  </button>
                  <button
                    onClick={() => setIsSecretMode(!isSecretMode)}
                    className={`ml-2 px-3 py-1 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all ${
                      isSecretMode
                        ? "bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50"
                        : "hover:bg-white/10 opacity-50"
                    }`}
                  >
                    {isSecretMode ? <Lock size={14} /> : <Unlock size={14} />}
                    {isSecretMode ? "Secret" : "Public"}
                  </button>
                </div>
              </div>

              <textarea
                id="quick-note-active-input-expanded"
                autoFocus
                value={tempNoteContent}
                onChange={(e) => setTempNoteContent(e.target.value)}
                className={`flex-1 p-8 text-lg bg-transparent outline-none resize-none leading-relaxed font-mono ${
                  mode === "Professional"
                    ? "text-slate-200 placeholder-slate-600"
                    : "text-stone-800 placeholder-stone-400"
                }`}
              />

              <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/5">
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
    </>
  );
}
