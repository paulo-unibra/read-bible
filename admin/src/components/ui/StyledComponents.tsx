import styled from "styled-components";

export const Container = styled.div`
  display: flex;
  min-height: 100vh;
  background: #f5f5f5;
`;

export const MainContent = styled.main`
  flex: 1;
  margin-left: 250px;
  padding: 30px;
`;

export const PageTitle = styled.h1`
  font-size: 28px;
  color: #1a1a2e;
  margin-bottom: 30px;
`;

export const FiltersSection = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
  flex-wrap: wrap;
`;

export const Input = styled.input`
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  flex: 1;
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: #4ecca3;
  }
`;

export const Select = styled.select`
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #4ecca3;
  }
`;

export const Button = styled.button`
  padding: 10px 20px;
  background: #4ecca3;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s;

  &:hover {
    background: #45b893;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

export const ActionButton = styled(Button)`
  padding: 8px 16px;
  font-size: 13px;
`;

export const Table = styled.table`
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-collapse: collapse;
`;

export const Thead = styled.thead`
  background: #1a1a2e;
  color: white;
`;

export const Tbody = styled.tbody``;

export const Tr = styled.tr`
  &:not(:last-child) {
    border-bottom: 1px solid #eee;
  }

  &:hover {
    background: #f9f9f9;
  }
`;

export const Th = styled.th`
  padding: 15px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
`;

export const Td = styled.td`
  padding: 15px;
  font-size: 14px;
  color: #333;
`;

interface BadgeProps {
  type?: "success" | "error" | "warning" | "info";
}

export const Badge = styled.span<BadgeProps>`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;

  background: ${(props) => {
    switch (props.type) {
      case "success":
        return "#d4edda";
      case "error":
        return "#f8d7da";
      case "warning":
        return "#fff3cd";
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
      case "warning":
        return "#856404";
      case "info":
        return "#0c5460";
      default:
        return "#383d41";
    }
  }};
`;

export const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 30px;

  span {
    color: #666;
    font-size: 14px;
  }
`;

export const EmptyState = styled.div`
  background: white;
  padding: 60px 20px;
  text-align: center;
  border-radius: 8px;
  color: #999;
  font-size: 16px;
`;

export const ErrorMessage = styled.div`
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
`;
