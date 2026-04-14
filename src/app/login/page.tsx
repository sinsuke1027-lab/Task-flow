'use client';

import { useAuth } from '@/context/auth-context';
import { User, Shield, Briefcase, Users, LayoutDashboard, Crown } from 'lucide-react';

const loginOptions = [
  { id: 'user_president', name: '山田 太郎', role: 'President', label: '代表取締役 (社長)', icon: Crown, color: 'bg-amber-100 text-amber-700' },
  { id: 'user_gm_sales_0', name: '高橋 健二', role: 'General Manager', label: '事業部長 (GM)', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  { id: 'user_tl_sales_0_0', name: '中村 浩', role: 'Team Leader', label: 'チームリーダー (TL)', icon: Users, color: 'bg-indigo-100 text-indigo-700' },
  { id: 'user_m_v6ate0xjx', name: '渡辺 洋子', role: 'Member', label: '一般社員 (メンバー)', icon: User, color: 'bg-slate-100 text-slate-700' },
  { id: 'user_admin_1', name: '佐藤 健二', role: 'General Manager', label: '管理部門 (Admin/受付側)', icon: Shield, color: 'bg-rose-100 text-rose-700' },
];

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Visual Side */}
      <div className="hidden lg:flex relative bg-slate-900 items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img 
            src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=2070" 
            alt="Office" 
            className="w-full h-full object-cover"
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
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Users</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-bold text-white mb-1">27+</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Teams</div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold">TB</div>
              <span className="font-bold text-xl tracking-tight">Task Bridge</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">ログイン選択</h2>
            <p className="text-slate-500 font-medium">デモ環境用：ログインするロールを選択してください</p>
          </div>

          <div className="space-y-3">
            {loginOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => login(option.id)}
                className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-400 hover:shadow-xl hover:-translate-y-0.5 transition-all group text-left"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${option.color} group-hover:scale-110 transition-transform`}>
                  <option.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{option.label}</div>
                  <div className="text-lg font-bold text-slate-900">{option.name}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
            Future Integration: Microsoft 365 Azure AD
          </p>
        </div>
      </div>
    </div>
  );
}
