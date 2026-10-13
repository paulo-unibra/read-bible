import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

const mergeClasses = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(" ");

type DivProps = HTMLAttributes<HTMLDivElement>;
type TableProps = HTMLAttributes<HTMLTableElement>;
type SectionProps = HTMLAttributes<HTMLElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
type InputProps = InputHTMLAttributes<HTMLInputElement>;
type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Container = ({ className, ...props }: DivProps) => (
  <div className={mergeClasses("flex min-h-screen bg-[var(--color-bg)]", className)} {...props} />
);

export const MainContent = ({ className, ...props }: SectionProps) => (
  <main
    className={mergeClasses(
      "ml-[var(--sidebar-width)] min-h-screen w-[calc(100%_-_var(--sidebar-width))] flex-1 bg-[radial-gradient(ellipse_at_18%_12%,rgba(248,203,243,0.72),transparent_38%),linear-gradient(135deg,#f5e4f5_0%,#eee3f7_55%,#e7e5fb_100%)] px-6 py-7 sm:px-8",
      className
    )}
    {...props}
  />
);

export const PageTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h1
    className={mergeClasses("mb-7 text-2xl font-semibold text-[var(--color-text)]", className)}
    {...props}
  />
);

export const FiltersSection = ({ className, ...props }: DivProps) => (
  <div className={mergeClasses("mb-6 flex flex-wrap gap-3", className)} {...props} />
);

export const Input = ({ className, ...props }: InputProps) => (
  <input
    className={mergeClasses(
      "min-w-[250px] flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-primary-light)]",
      className
    )}
    {...props}
  />
);

export const Select = ({ className, ...props }: SelectProps) => (
  <select
    className={mergeClasses(
      "cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-primary-light)]",
      className
    )}
    {...props}
  />
);

const buttonClasses =
  "inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 bg-[var(--color-primary)] px-[18px] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-border-strong)]";

export const Button = ({ className, ...props }: ButtonProps) => (
  <button className={mergeClasses(buttonClasses, className)} {...props} />
);

export const ActionButton = ({ className, ...props }: ButtonProps) => (
  <Button className={mergeClasses("px-4 py-2 text-[13px]", className)} {...props} />
);

export const Table = ({ className, ...props }: TableProps) => (
  <table
    className={mergeClasses(
      "w-full overflow-hidden rounded-[var(--radius-md)] border border-collapse border-[var(--color-border)] bg-white/60 shadow-[var(--shadow-sm)] backdrop-blur-xl",
      className
    )}
    {...props}
  />
);

export const Thead = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead
    className={mergeClasses("bg-white/55 text-[var(--color-text-secondary)]", className)}
    {...props}
  />
);

export const Tbody = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={className} {...props} />
);

export const Tr = ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={mergeClasses(
      "border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]",
      className
    )}
    {...props}
  />
);

export const Th = ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={mergeClasses(
      "px-[15px] py-3.5 text-left text-[12.5px] font-semibold uppercase tracking-[0.03em]",
      className
    )}
    {...props}
  />
);

export const Td = ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={mergeClasses("px-[15px] py-3.5 text-sm text-[var(--color-text)]", className)}
    {...props}
  />
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  type?: "success" | "error" | "warning" | "info";
};

const badgeColors = {
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  error: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info)]",
  neutral: "bg-[var(--color-primary-light)] text-[var(--color-primary-text)]",
};

export const Badge = ({ className, type, ...props }: BadgeProps) => (
  <span
    className={mergeClasses(
      "inline-block rounded-full px-3 py-1 text-xs font-semibold",
      badgeColors[type || "neutral"],
      className
    )}
    {...props}
  />
);

export const Pagination = ({ className, ...props }: DivProps) => (
  <div
    className={mergeClasses(
      "mt-7 flex items-center justify-center gap-5 [&_span]:text-sm [&_span]:text-[var(--color-text-secondary)]",
      className
    )}
    {...props}
  />
);

export const EmptyState = ({ className, ...props }: DivProps) => (
  <div
    className={mergeClasses(
      "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-[60px] text-center text-[15px] text-[var(--color-text-muted)]",
      className
    )}
    {...props}
  />
);

export const ErrorMessage = ({ className, ...props }: DivProps) => (
  <div
    className={mergeClasses(
      "mb-5 rounded-[var(--radius-sm)] border border-[rgba(220,38,38,0.2)] bg-[var(--color-danger-bg)] px-4 py-3.5 text-[var(--color-danger)]",
      className
    )}
    {...props}
  />
);
