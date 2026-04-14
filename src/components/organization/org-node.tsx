'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Building2, Shield, User as UserIcon } from 'lucide-react';
import { OrganizationUnit, User } from '@/lib/repository/types';
import { cn } from '@/lib/utils';

interface OrgNodeProps {
  unit: OrganizationUnit;
  allUnits: OrganizationUnit[];
  usersInUnit: User[];
  taskCounts?: Record<string, number>;
  mode?: 'stagnation' | 'directory';
  isExpandedInitial?: boolean;
  onUserClick?: (user: User) => void;
}

/**
 * 組織図の階層構造を再帰的にレンダリングするコンポーネント
 */
export function OrgNode({
  unit,
  allUnits,
  usersInUnit,
  taskCounts = {},
  mode = 'directory',
  isExpandedInitial = false,
  onUserClick
}: OrgNodeProps) {
  const [isExpanded, setIsExpanded] = useState(isExpandedInitial);

  const childUnits = allUnits.filter(u => u.parentId === unit.id);
  const directUsers = usersInUnit.filter(u => u.orgUnitId === unit.id);

  // 滞留タスクの再帰的計算（stagnationモード用）
  const getRecursiveTaskCount = (currentUnitId: string): number => {
    const dUsers = usersInUnit.filter(u => u.orgUnitId === currentUnitId);
    const dCount = dUsers.reduce((sum, u) => sum + (taskCounts[u.id] || 0), 0);
    const children = allUnits.filter(u => u.parentId === currentUnitId);
    const childrenCount = children.reduce((sum, child) => sum + getRecursiveTaskCount(child.id), 0);
    return dCount + childrenCount;
  };

  const totalCount = mode === 'stagnation' ? getRecursiveTaskCount(unit.id) : 0;

  // 滞留モードで件数が0の場合は非表示（ルート以外）
  if (mode === 'stagnation' && totalCount === 0 && unit.type !== 'root') {
    return null;
  }

  return (
    <div className={cn(
      "ml-4 border-l pl-4 py-1",
      mode === 'directory' ? "border-slate-200" : "border-slate-100"
    )}>
      <div
        className="flex items-center gap-2 group cursor-pointer py-1.5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-slate-600">
          {childUnits.length > 0 || directUsers.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="w-1 h-1 bg-slate-200 rounded-full ml-1.5" />
          )}
        </div>
        <Building2 className={cn(
          "w-4 h-4 transition-colors",
          isExpanded ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"
        )} />
        <span className={cn(
          "text-sm font-bold transition-colors",
          isExpanded ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
        )}>
          {unit.name}
        </span>

        {/* 滞留カウントバッジ */}
        {mode === 'stagnation' && totalCount > 0 && (
          <span className={cn(
            "text-[10px] font-black px-2 py-0.5 rounded-full transition-all",
            totalCount > 10 ? 'bg-rose-500 text-white' :
            totalCount > 5 ? 'bg-amber-500 text-white' :
            'bg-slate-900 text-white'
          )}>
            {totalCount}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-300">
          {/* 子ユニットを再帰表示 */}
          {childUnits.map(child => (
            <OrgNode
              key={child.id}
              unit={child}
              allUnits={allUnits}
              usersInUnit={usersInUnit}
              taskCounts={taskCounts}
              mode={mode}
              onUserClick={onUserClick}
            />
          ))}

          {/* 所属ユーザーを表示 */}
          {directUsers.map(user => {
            const count = taskCounts[user.id] || 0;
            // 滞留モードで個人の件数が0の場合は非表示
            if (mode === 'stagnation' && count === 0) return null;

            return (
              <div
                key={user.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onUserClick?.(user);
                }}
                className={cn(
                  "ml-9 flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer group hover:bg-white hover:notion-shadow border border-transparent",
                  mode === 'directory' ? "hover:border-slate-200" : ""
                )}
              >
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 p-0.5 border group-hover:border-slate-400 transition-all overflow-hidden flex items-center justify-center">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full rounded" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  {/* 管理者バッジ（Shieldアイコン） */}
                  {mode === 'directory' && user.role === 'admin' && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-900 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                      <Shield className="w-2 h-2 text-white fill-white" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{user.name}</span>
                    {mode === 'directory' && user.role === 'admin' && (
                      <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Admin</span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none truncate">{user.position}</span>
                </div>

                {/* 右側のインジケータ（モード別） */}
                {mode === 'stagnation' ? (
                  <span className={cn(
                    "ml-auto text-[10px] font-black px-2 py-0.5 rounded-lg border",
                    count > 5 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'
                  )}>
                    {count} 件
                  </span>
                ) : (
                  <ChevronRight className="ml-auto w-3 h-3 text-slate-200 group-hover:text-slate-400 transition-all opacity-0 group-hover:opacity-100 group-hover:translate-x-1" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
