import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Info, CheckCircle, AlertTriangle } from "lucide-react";

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            layout
            className="pointer-events-auto w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-slate-100 p-4 rounded-xl shadow-2xl flex items-start gap-3 relative overflow-hidden"
          >
            {/* Sidebar Color Accent */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 ${
                toast.type === "error"
                  ? "bg-red-500"
                  : toast.type === "success"
                    ? "bg-green-500"
                    : "bg-orange-500"
              }`}
            />

            {/* Icon */}
            <div
              className={`mt-0.5 p-1.5 rounded-lg ${
                toast.type === "error"
                  ? "bg-red-500/20 text-red-400"
                  : toast.type === "success"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-orange-500/20 text-orange-400"
              }`}
            >
              {toast.type === "error" ? (
                <AlertTriangle size={16} />
              ) : toast.type === "success" ? (
                <CheckCircle size={16} />
              ) : (
                <Bell size={16} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold truncate">
                {toast.title || "Notification"}
              </h4>
              <p className="text-xs opacity-80 mt-1 leading-relaxed break-words">
                {toast.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-50 hover:opacity-100 p-1 -mr-2 -mt-2 transition-opacity"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
