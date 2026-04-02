"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Package, LogIn, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: "user" | "admin") => {
    if (role === "admin") {
      setValue("email", "admin@example.com");
      setValue("password", "Admin@1234");
    } else {
      setValue("email", "demo@example.com");
      setValue("password", "Demo@1234");
    }
    handleSubmit(onSubmit)();
  };

  return (
    <div className="min-h-screen flex">
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.4'%3E%3Cpath d='M36 34v2h-2v-2h2zm0-4h2v2h-2v-2zm-4 8v-2h2v2h-2zm2-2v-2h2v2h-2z'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">InvenTrack</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Smart Inventory &<br />Order Management
          </h1>
          <p className="text-lg text-slate-400 max-w-md leading-relaxed">
            Streamline your warehouse operations with real-time stock tracking,
            automated restock alerts, and powerful order management.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { label: "Products", value: "15+" },
              { label: "Real-time", value: "Stock" },
              { label: "Analytics", value: "Live" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-2xl font-bold text-orange-400">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-lg bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-800">InvenTrack</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-[15px] mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600 text-[13px] font-medium">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com"
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors rounded-lg"
                {...register("email")} />
              {errors.email && <p className="text-[13px] text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-600 text-[13px] font-medium">Password</Label>
              <Input id="password" type="password" placeholder="Enter your password"
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors rounded-lg"
                {...register("password")} />
              {errors.password && <p className="text-[13px] text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit"
              className="w-full h-11 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-[14px] font-semibold rounded-lg"
              disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-lg animate-spin" />
              ) : (
                <><LogIn className="h-4 w-4 mr-2" />Sign In</>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium">or try it out</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline"
              className="h-11 border-dashed border-slate-300 hover:border-orange-300 hover:bg-orange-50/50 text-slate-600 text-[14px] font-medium transition-all rounded-lg"
              onClick={() => handleDemoLogin("user")} disabled={loading}>
              <User className="h-4 w-4 mr-1.5 text-slate-400" />
              Demo User
            </Button>
            <Button variant="outline"
              className="h-11 border-dashed border-slate-300 hover:border-amber-300 hover:bg-amber-50/50 text-slate-600 text-[14px] font-medium transition-all rounded-lg"
              onClick={() => handleDemoLogin("admin")} disabled={loading}>
              <Shield className="h-4 w-4 mr-1.5 text-amber-500" />
              Demo Admin
            </Button>
          </div>

          <p className="text-center text-[14px] text-slate-500 mt-8">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-orange-600 hover:text-orange-700 font-semibold">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
