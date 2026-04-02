"use client";

import { AuthGuard } from "@/components/auth-guard";
import { AppLayout } from "@/components/layout/app-layout";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
