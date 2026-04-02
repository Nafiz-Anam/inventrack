"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Package, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuthStore((s) => s.register);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      await registerUser(data.name, data.email, data.password);
      toast.success("Account created! Please sign in.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Create your account</h2>
          <p className="text-slate-500 text-[15px] mt-1">Get started with InvenTrack</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-600 text-[13px] font-medium">Full Name</Label>
              <Input placeholder="John Doe" className="h-11 bg-slate-50 border-slate-200 focus:bg-white rounded-lg" {...register("name")} />
              {errors.name && <p className="text-[13px] text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 text-[13px] font-medium">Email address</Label>
              <Input type="email" placeholder="you@example.com" className="h-11 bg-slate-50 border-slate-200 focus:bg-white rounded-lg" {...register("email")} />
              {errors.email && <p className="text-[13px] text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 text-[13px] font-medium">Password</Label>
              <Input type="password" placeholder="Min 8 characters" className="h-11 bg-slate-50 border-slate-200 focus:bg-white rounded-lg" {...register("password")} />
              {errors.password && <p className="text-[13px] text-red-500">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 text-[13px] font-medium">Confirm Password</Label>
              <Input type="password" placeholder="Repeat password" className="h-11 bg-slate-50 border-slate-200 focus:bg-white rounded-lg" {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="text-[13px] text-red-500">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit"
              className="w-full h-11 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-[14px] font-semibold mt-2 rounded-lg"
              disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-lg animate-spin" />
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" />Create Account</>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-[14px] text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-600 hover:text-orange-700 font-semibold">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
