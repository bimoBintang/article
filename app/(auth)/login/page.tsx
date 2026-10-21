"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);
 const router = useRouter();

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setLoading(true);

 try {
 const res = await fetch("/api/auth/login", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email, password }),
 });

 const data = await res.json();

 if (!res.ok) {
 setError(data.error || "Login gagal");
 setLoading(false);
 return;
 }

 setLoading(false);
 router.push("/admin/dashboard");
 router.refresh();
 } catch {
 setError("Terjadi kesalahan server");
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-zinc-100">
 <div className="w-full max-w-md px-6">
 <div className="text-center mb-8">
 <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
 A
 </div>
 <h1 className="text-2xl font-bold text-foreground">Masuk Admin</h1>
 <p className="text-zinc-600">
 Studio Article
 </p>
 </div>

 <div className="bg-white rounded-xl border border-zinc-200 p-8 shadow-sm">
 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Email
 </label>
 <div className="relative">
 <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full pl-10 pr-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none border-zinc-300"
 placeholder="admin@ekatalog.local"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Kata Sandi
 </label>
 <div className="relative">
 <Lock className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
 <input
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full pl-10 pr-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none border-zinc-300"
 placeholder="••••••••"
 />
 </div>
 </div>

 {error && (
 <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
 <AlertCircle className="w-4 h-4" />
 {error}
 </div>
 )}

 <button
 type="submit"
 disabled={loading}
 className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-70 transition-colors"
 >
 {loading ? "Memproses..." : "Masuk"}
 </button>
 </form>

 <p className="mt-6 text-center text-xs text-zinc-500">
 Akun default: admin@ekatalog.local / admin123<br />
 (Ubah kredensial di production)
 </p>
 </div>

 <p className="mt-6 text-center text-sm text-zinc-600">
 <Link href="/" className="text-primary hover:underline">Kembali ke beranda</Link>
 </p>
 </div>
 </div>
 );
}
