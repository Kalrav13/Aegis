import React from 'react';
import { 
  Activity, 
  BarChart3, 
  Layers, 
  FileCode, 
  Settings, 
  GitBranch 
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  projectName?: string;
  repoUrl?: string;
}

export default function Layout({ 
  children, 
  activeTab, 
  onTabChange,
  projectName = "TestLens Core",
  repoUrl = "github.com/company/repo"
}: LayoutProps) {
  const navItems = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: Activity },
    { id: 'features', label: 'Feature Explorer', icon: FileCode },
    { id: 'coverage', label: 'Coverage Maps', icon: Layers },
    { id: 'execution', label: 'Execution Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#080b11] text-slate-100 antialiased">
      {/* Sidebar navigation */}
      <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="h-9 w-9 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-500/20">
              TL
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">TestLens</span>
              <span className="block text-[10px] text-slate-500 font-semibold tracking-wider uppercase">v1.0.0 Release</span>
            </div>
          </div>

          {/* Project Details context */}
          <div className="px-6 py-4 border-b border-slate-900 bg-slate-950/40">
            <div className="flex items-center space-x-2 text-indigo-400 font-medium text-xs truncate">
              <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{projectName}</span>
            </div>
            <span className="block text-[10px] text-slate-500 truncate mt-1">{repoUrl}</span>
          </div>

          {/* Navigation link list */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-500 shadow-glass' 
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <IconComp className={`h-4.5 w-4.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="p-6 border-t border-slate-850 bg-slate-950/25">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Status</span>
            <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-xs">
              <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              <span>Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main dashboard viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-slate-900 glass-card px-8 flex items-center justify-between sticky top-0 z-40">
          <h2 className="font-semibold text-lg text-slate-100">
            {navItems.find(i => i.id === activeTab)?.label || 'Overview'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="h-2.5 w-2.5 bg-indigo-500 rounded-full animate-ping"></div>
            <span className="text-xs text-slate-400 font-medium bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              Intelligence Processor Connected
            </span>
          </div>
        </header>

        {/* View Content area */}
        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
