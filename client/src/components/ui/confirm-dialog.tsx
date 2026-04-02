"use client";

import { useState, useCallback, createContext, useContext, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    description: "",
  });
  const resolveRef = useRef<(value: boolean) => void>();

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setOpen(false);
    resolveRef.current?.(false);
  };

  const isDanger = options.variant === "danger";

  return (
    <ConfirmContext value={{ confirm }}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <DialogContent className="max-w-[400px] p-0 gap-0">
          <div className="p-6 pb-4">
            <DialogHeader>
              <div className="flex items-start gap-3">
                {isDanger && (
                  <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                )}
                <div>
                  <DialogTitle className="text-[16px] font-semibold text-slate-800">
                    {options.title || "Are you sure?"}
                  </DialogTitle>
                  <p className="text-[14px] text-slate-500 mt-1.5 leading-relaxed">
                    {options.description}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Button
              variant="outline"
              className="h-9 px-4 border-slate-200 text-slate-600 text-[13px]"
              onClick={handleCancel}
            >
              {options.cancelText || "Cancel"}
            </Button>
            <Button
              className={`h-9 px-4 text-[13px] font-semibold ${
                isDanger
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
              onClick={handleConfirm}
            >
              {options.confirmText || "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext>
  );
}
