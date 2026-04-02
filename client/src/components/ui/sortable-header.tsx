"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort?: string;
  currentOrder?: "asc" | "desc";
  onSort: (field: string, order: "asc" | "desc") => void;
  className?: string;
}

export function SortableHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort === field;

  const handleClick = () => {
    if (!isActive) {
      onSort(field, "asc");
    } else if (currentOrder === "asc") {
      onSort(field, "desc");
    } else {
      onSort(field, "asc");
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={`-ml-3 h-8 text-[12px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 hover:bg-transparent ${className || ""}`}
    >
      {label}
      {isActive ? (
        currentOrder === "asc" ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
      )}
    </Button>
  );
}
