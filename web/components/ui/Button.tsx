import React from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "text" | "pill";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "secondary"
      ? "btn-secondary"
      : variant === "text"
      ? "btn-text"
      : variant === "pill"
      ? "btn-primary btn-pill"
      : "btn-primary";

  const sizeClass = size === "sm" ? "btn-sm" : "";
  const combinedClass = `btn ${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <button
      type={type}
      className={combinedClass}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  external?: boolean;
  target?: string;
  rel?: string;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  children,
  className = "",
  ariaLabel,
  external,
  target,
  rel,
}: LinkButtonProps) {
  const variantClass =
    variant === "secondary"
      ? "btn-secondary"
      : variant === "text"
      ? "btn-text"
      : variant === "pill"
      ? "btn-primary btn-pill"
      : "btn-primary";

  const sizeClass = size === "sm" ? "btn-sm" : "";
  const combinedClass = `btn ${variantClass} ${sizeClass} ${className}`.trim();

  if (external) {
    return (
      <a
        href={href}
        className={combinedClass}
        aria-label={ariaLabel}
        target={target || "_blank"}
        rel={rel || "noopener noreferrer"}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={combinedClass} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export default Button;
