import React, { useEffect } from "react";
import styled, { keyframes } from "styled-components";

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const ToastContainer = styled.div<{
  type: "success" | "error" | "info";
  isClosing: boolean;
}>`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 16px 24px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 9999;
  min-width: 300px;
  animation: ${(props) => (props.isClosing ? slideOut : slideIn)} 0.3s ease-out;

  background: ${(props) => {
    switch (props.type) {
      case "success":
        return "#d4edda";
      case "error":
        return "#f8d7da";
      case "info":
        return "#d1ecf1";
      default:
        return "#e2e3e5";
    }
  }};

  color: ${(props) => {
    switch (props.type) {
      case "success":
        return "#155724";
      case "error":
        return "#721c24";
      case "info":
        return "#0c5460";
      default:
        return "#383d41";
    }
  }};

  border-left: 4px solid
    ${(props) => {
      switch (props.type) {
        case "success":
          return "#28a745";
        case "error":
          return "#dc3545";
        case "info":
          return "#17a2b8";
        default:
          return "#6c757d";
      }
    }};
`;

const Icon = styled.span`
  font-size: 20px;
`;

const Message = styled.span`
  flex: 1;
  font-size: 14px;
  font-weight: 500;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  opacity: 0.7;
  padding: 0;

  &:hover {
    opacity: 1;
  }
`;

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  type = "success",
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isClosing, setIsClosing] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Tempo da animação
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "info":
        return "ℹ️";
      default:
        return "📢";
    }
  };

  return (
    <ToastContainer type={type} isClosing={isClosing}>
      <Icon>{getIcon()}</Icon>
      <Message>{message}</Message>
      <CloseButton onClick={handleClose}>×</CloseButton>
    </ToastContainer>
  );
}
