import { useState } from "react";
import axios from "axios";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../config";

export default function Auth({ onLogin }) {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    age: "",
    gender: "",
    profession: "",
    shadow_type: "Career Mode",
    current_focus: "",
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      if (authMode === "signup") {
        await axios.post(`${API_BASE}/register`, {
          email,
          password,
          profile: {
            ...profile,
            age: parseInt(profile.age),
          },
        });
        setAuthMode("login");
        setAuthError("Account created! Please log in.");
      } else {
        const formData = new FormData();
        formData.append("username", email);
        formData.append("password", password);
        const res = await axios.post(`${API_BASE}/token`, formData);

        // Pass success data back to App
        onLogin(res.data);
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="text-white" size={24} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Welcome to Zenith
        </h1>
        <p className="text-slate-400 text-center mb-8 text-sm">
          Your context-aware AI workspace.
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
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

          <AnimatePresence>
            {authMode === "signup" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden pt-2"
              >
                {/* Profile Fields */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name"
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
                {/* ... Add other signup fields here (Gender, Profession, etc) as in original ... */}
                <input
                  type="text"
                  placeholder="Profession"
                  value={profile.profession}
                  onChange={(e) =>
                    setProfile({ ...profile, profession: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600"
                  required
                />
                <select
                  value={profile.shadow_type}
                  onChange={(e) =>
                    setProfile({ ...profile, shadow_type: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="Career Mode">👔 Career Mode</option>
                  <option value="Zen Mode">🧘 Zen Mode</option>
                  <option value="Witty Companion">😜 Witty Companion</option>
                  <option value="Drill Sergeant">🪖 Drill Sergeant</option>
                </select>
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
