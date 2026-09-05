"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export const Button = ({
  children,
  className,
  variant = "primary",
  ...rest
}: ButtonProps) => {
  return (
    <button
      {...rest}
      className={[`ui-button`, `ui-button--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
};
