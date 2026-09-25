"use client";

import type { ReactNode } from "react";
import { buttonClass } from "./ui";

export function ConfirmButton({
  action,
  message,
  children,
  variant = "danger",
  size = "md",
}: {
  action: () => Promise<void>;
  message: string;
  children: ReactNode;
  variant?: "danger" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <button className={buttonClass(variant, size)}>{children}</button>
    </form>
  );
}
