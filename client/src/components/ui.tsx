import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-surface rounded-2xl shadow-card p-4 ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-brand-500 text-bg font-semibold shadow-glow active:bg-brand-700 disabled:opacity-40 disabled:shadow-none",
    secondary: "bg-gray-100 text-gray-800 active:bg-gray-200",
    danger: "bg-red-50 text-red-600 active:bg-red-100",
    ghost: "bg-transparent text-brand-400 active:text-brand-300",
  }[variant];
  return (
    <button
      className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.97] ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-bg-raised text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-gray-400 text-sm py-8">{children}</div>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-bold text-gray-900 mb-4">{children}</h1>;
}
