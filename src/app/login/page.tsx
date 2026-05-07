'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/auth-context';
import { User, Shield, Briefcase, Users, LayoutDashboard, Crown, Loader2 } from 'lucide-react';

const isMockMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

const demoUsers = [
  { email: 'yamada.t@example.com', name: '山田 太郎', label: '代表取締役 (社長)', icon: Crown, color: 'bg-amber-100 text-amber-700' },
  { email: 'sales.gm0@example.com', name: '高橋 健二', label: '事業部長 (GM)', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  { email: 'sales.tl00@example.com', name: '中村 浩', label: 'チームリーダー (TL)', icon: Users, color: 'bg-indigo-100 text-indigo-700' },
  { email: 'sales.m000@example.com', name: '渡辺 洋子', label: '一般社員 (メンバー)', icon: User, color: 'bg-slate-100 text-slate-700' },
  { email: 'kenji.sato@example.com', name: '佐藤 健二', label: '管理部門 (Admin/受付側)', icon: Shield, color: 'bg-rose-100 text-rose-700' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password || 'demo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(demoEmail, 'demo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Visual Side */}
      <div className="hidden lg:flex relative bg-slate-900 items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <Image
            src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=2070"
            alt="Office"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative z-10 w-full max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white text-slate-900 rounded-xl flex items-center justify-center font-bold text-2xl shadow-2xl">
              TB
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Task Bridge</h1>
          </div>
          <p className="text-xl text-slate-200 leading-relaxed font-medium mb-12">
            バックオフィスと事業部をつなぐ、<br />
            次世代の申請管理プラットフォーム。
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-bold text-white mb-1">147+</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Users</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-bold text-white mb-1">27+</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Teams</div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold">TB</div>
              <span className="font-bold text-xl tracking-tight">Task Bridge</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">ログイン</h2>
            <p className="text-slate-500 font-medium">
              {isMockMode ? 'デモ環境：メールアドレスでログイン' : 'メールアドレスとパスワードを入力してください'}
            </p>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-2">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
              />
            </div>
            {!isMockMode && (
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              ログイン
            </button>
          </form>

          {/* Demo quick-access (mock mode only) */}
          {isMockMode && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">デモ（ワンクリック）</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="space-y-3">
                {demoUsers.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => handleDemoLogin(u.email)}
                    disabled={isSubmitting}
                    className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-400 hover:shadow-xl hover:-translate-y-0.5 transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${u.color} group-hover:scale-110 transition-transform`}>
                      <u.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{u.label}</div>
                      <div className="text-base font-bold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mt-8 text-center text-xs text-slate-500 font-bold uppercase tracking-widest">
            {isMockMode ? 'Mock Mode — No Database Connection' : 'Powered by Supabase Auth'}
          </p>
        </div>
      </div>
    </div>
  );
}
