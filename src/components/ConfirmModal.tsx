import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "../lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger"
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn("w-4 h-4", variant === "danger" ? "text-red-600" : "text-yellow-600")} />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{title}</h3>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-[11px] text-gray-600 leading-relaxed uppercase tracking-tight">
                {message}
              </p>
            </div>

            <div className="p-3 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-900 uppercase transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-bold text-white rounded uppercase transition-all shadow-sm",
                  variant === "danger" ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200"
                )}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
