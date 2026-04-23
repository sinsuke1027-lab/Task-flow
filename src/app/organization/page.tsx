'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { 
  Building2, 
  Search, 
  X, 
  Mail, 
  MapPin, 
  Phone, 
  Shield, 
  ChevronRight,
  ExternalLink,
  Target
} from 'lucide-react';
import { getDataProvider } from '@/lib/repository/factory';
import { User, OrganizationUnit } from '@/lib/repository/types';
import { OrgNode } from '@/components/organization/org-node';
import { cn } from '@/lib/utils';

export default function OrganizationPage() {
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const provider = getDataProvider();
        const [allUnits, allUsers] = await Promise.all([
          provider.getOrganizationUnits(),
          provider.getUsers()
        ]);
        setUnits(allUnits);
        setUsers(allUsers);
      } catch (error) {
        console.error('Failed to fetch organization data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.position.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [users, debouncedQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Building Organization Map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-160px)] animate-in fade-in duration-700">
      {/* Header Section */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-400">
            <Building2 className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Workspace Directory</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-[#191714]">組織図</h1>
          <p className="text-slate-500 font-medium">組織構造の確認とメンバーの検索が可能です。</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
          <input 
            type="text" 
            placeholder="氏名、役職、メールアドレスで検索..." 
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:border-slate-400 focus:notion-shadow transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Tree View */}
        <div className={cn(
          "transition-all duration-500",
          selectedUser ? "lg:col-span-8" : "lg:col-span-12"
        )}>
          <div className="bg-white rounded-[32px] border border-slate-200 notion-shadow overflow-hidden">
            <div className="px-8 py-6 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-slate-900" />
                <h2 className="text-lg font-bold text-slate-900">組織構造</h2>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-slate-900 rounded-full border border-white shadow-sm" />
                  <span>管理者</span>
                </div>
                <div>Total {users.length} Members</div>
              </div>
            </div>
            
            <div className="p-8 min-h-[500px]">
              {units.length > 0 && units.filter(u => u.parentId === null).map(root => (
                <OrgNode 
                  key={root.id}
                  unit={root}
                  allUnits={units}
                  usersInUnit={users}
                  mode="directory"
                  isExpandedInitial={true}
                  onUserClick={setSelectedUser}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Selected User Detail Panel (Desktop Sidebar) */}
        {selectedUser && (
          <aside className="lg:col-span-4 animate-in slide-in-from-right-8 duration-500 sticky top-8 h-fit">
            <div className="bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl text-white">
              <div className="relative h-32 bg-gradient-to-br from-slate-800 to-slate-900">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="px-8 pb-10 -mt-12 space-y-8">
                <div className="space-y-4">
                  <div className="relative inline-block">
                    {selectedUser.avatar
                      ? <Image src={selectedUser.avatar} width={96} height={96} alt={selectedUser.name} className="w-24 h-24 rounded-3xl border-4 border-slate-900 bg-slate-800 shadow-xl" />
                      : <div className="w-24 h-24 rounded-3xl border-4 border-slate-900 bg-slate-800 shadow-xl" />
                    }
                    {selectedUser.role === 'admin' && (
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white text-slate-900 rounded-2xl flex items-center justify-center shadow-lg border-2 border-slate-900">
                        <Shield className="w-4 h-4 fill-slate-900" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black tracking-tight">{selectedUser.name}</h3>
                      {selectedUser.role === 'admin' && (
                        <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-tighter">System Admin</span>
                      )}
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">{selectedUser.position}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-2">Contact Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 group cursor-pointer hover:text-slate-300 transition-colors">
                        <Mail className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                        <span className="text-sm font-bold truncate">{selectedUser.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <Phone className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-bold">03-XXXX-XXXX (内線 123)</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-2">Managed Responsibilities</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-400">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-bold">本社オフィス (東京)</span>
                      </div>
                      {selectedUser.role === 'admin' && selectedUser.departmentId && (
                        <div className="flex items-center gap-3 text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-xl border border-emerald-400/20">
                          <Shield className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">{selectedUser.departmentId} 部門管理者</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowProfileModal(true)}
                  className="w-full flex items-center justify-center gap-2 h-12 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  プロフィール詳細を表示
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* プロフィール詳細モーダル */}
      {showProfileModal && selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#191714]">プロフィール詳細</h3>
              <button onClick={() => setShowProfileModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                {selectedUser.avatar
                  ? <Image src={selectedUser.avatar} width={64} height={64} alt={selectedUser.name} className="w-16 h-16 rounded-2xl bg-slate-100 border" />
                  : <div className="w-16 h-16 rounded-2xl bg-slate-100 border" />
                }
                <div>
                  <div className="text-xl font-black text-[#191714]">{selectedUser.name}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedUser.position}</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'メールアドレス', value: selectedUser.email },
                  { label: '所属ユニットID', value: selectedUser.orgUnitId },
                  { label: 'ステータス', value: selectedUser.status === 'active' ? '在籍' : selectedUser.status === 'inactive' ? '退職' : '休職中' },
                  { label: '入社日', value: new Date(selectedUser.joinedAt).toLocaleDateString('ja-JP') },
                  ...(selectedUser.leftAt ? [{ label: '退職日', value: new Date(selectedUser.leftAt).toLocaleDateString('ja-JP') }] : []),
                  { label: 'システムロール', value: selectedUser.role === 'admin' ? '管理者' : '一般ユーザー' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">{row.label}</span>
                    <span className="font-bold text-[#191714]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Global Search Results Overlay (if searching) */}
      {debouncedQuery && (
        <div className="fixed inset-x-0 bottom-0 top-[260px] z-40 bg-slate-50/95 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="max-w-4xl mx-auto px-6 py-10 h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black tracking-tight text-slate-900">
                検索結果: <span className="text-slate-400">{filteredUsers.length}件</span>
              </h3>
              <button
                onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all text-xs font-bold text-slate-500"
              >
                <X className="w-4 h-4" />
                検索を閉じる
              </button>
            </div>

            {filteredUsers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                {filteredUsers.map(u => (
                  <div 
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setSearchQuery('');
                      setDebouncedQuery('');
                    }}
                    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:notion-shadow hover:border-slate-400 transition-all cursor-pointer group"
                  >
                    <div className="relative">
                      {u.avatar
                        ? <Image src={u.avatar} width={48} height={48} alt={u.name} className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 group-hover:border-slate-300 transition-all" />
                        : <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100" />
                      }
                      {u.role === 'admin' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-900 rounded-full border border-white flex items-center justify-center shadow-sm">
                          <Shield className="w-2.5 h-2.5 text-white fill-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{u.name}</span>
                        {u.role === 'admin' && (
                           <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-50 px-1 py-0.5 rounded border border-slate-100">Admin</span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.position}</span>
                    </div>
                    <ChevronRight className="ml-auto w-4 h-4 text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Search className="w-12 h-12 mb-4 opacity-10" />
                <p className="font-bold uppercase tracking-widest text-xs">No matching members found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
