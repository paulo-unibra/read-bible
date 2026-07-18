import styled from "styled-components";

export const Container = styled.div`
  display: flex;
  min-height: 100vh;
  background: var(--color-bg);
`;

export const MainContent = styled.main`
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: 32px;
  width: calc(100% - var(--sidebar-width));
`;

export const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 28px;
`;

export const FiltersSection = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

export const Input = styled.input`
  padding: 10px 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: 14px;
  flex: 1;
  min-width: 250px;
  background: var(--color-surface);
  color: var(--color-text);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }
`;

export const Select = styled.select`
  padding: 10px 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }
`;

export const Button = styled.button`
  padding: 10px 18px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--color-primary-hover);
  }

  &:disabled {
    background: var(--color-border-strong);
    cursor: not-allowed;
  }
`;

export const ActionButton = styled(Button)`
  padding: 8px 16px;
  font-size: 13px;
`;

export const Table = styled.table`
  width: 100%;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
  border-collapse: collapse;
`;

export const Thead = styled.thead`
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
`;

export const Tbody = styled.tbody``;

export const Tr = styled.tr`
  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  &:hover {
    background: var(--color-surface-hover);
  }
`;

export const Th = styled.th`
  padding: 14px 15px;
  text-align: left;
  font-weight: 600;
  font-size: 12.5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

export const Td = styled.td`
  padding: 14px 15px;
  font-size: 14px;
  color: var(--color-text);
`;

interface BadgeProps {
  type?: "success" | "error" | "warning" | "info";
}

export const Badge = styled.span<BadgeProps>`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;

  background: ${(props) => {
    switch (props.type) {
      case "success":
        return "var(--color-success-bg)";
      case "error":
        return "var(--color-danger-bg)";
      case "warning":
        return "var(--color-warning-bg)";
      case "info":
        return "var(--color-info-bg)";
      default:
        return "var(--color-primary-light)";
    }
  }};

  color: ${(props) => {
    switch (props.type) {
      case "success":
        return "var(--color-success)";
      case "error":
        return "var(--color-danger)";
      case "warning":
        return "var(--color-warning)";
      case "info":
        return "var(--color-info)";
      default:
        return "var(--color-primary-text)";
    }
  }};
`;

export const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 28px;

  span {
    color: var(--color-text-secondary);
    font-size: 14px;
  }
`;

export const EmptyState = styled.div`
  background: var(--color-surface);
  padding: 60px 20px;
  text-align: center;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 15px;
  border: 1px solid var(--color-border);
`;

export const ErrorMessage = styled.div`
  background: var(--color-danger-bg);
  color: var(--color-danger);
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 20px;
  border: 1px solid rgba(220, 38, 38, 0.2);
`;
