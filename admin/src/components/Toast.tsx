import React, { useCallback, useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

const toastStyles = {
  success: "border-l-[#28a745] bg-[#d4edda] text-[#155724]",
  error: "border-l-[#dc3545] bg-[#f8d7da] text-[#721c24]",
  info: "border-l-[#17a2b8] bg-[#d1ecf1] text-[#0c5460]",
};

export default function Toast({
  message,
  type = "success",
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isClosing, setIsClosing] = React.useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";

  return (
    <div
      role="status"
      className={`fixed right-5 top-5 z-[9999] flex min-w-[300px] items-center gap-3 rounded-lg border-l-4 px-6 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-300 ${toastStyles[type]} ${isClosing ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}
    >
      <span className="text-xl">{icon}</span>
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fechar aviso"
        className="cursor-pointer border-0 bg-transparent p-0 text-lg opacity-70 transition-opacity hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
