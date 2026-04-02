"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-30">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-9 w-9"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5 text-slate-600" />
      </Button>
    </header>
  );
}
