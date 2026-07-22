import { Users, Settings, Info, Award, FileText, Briefcase } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const menuItems = [
  { id: "employees", label: "Employee", icon: Users },
  { id: "micro-credentials", label: "Micro-Credentials", icon: Award },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "about", label: "About", icon: Info },
];

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <aside className="w-56 h-full bg-gradient-to-b from-teal-900 via-teal-800 to-teal-900 text-teal-100 flex flex-col shrink-0 shadow-2xl relative z-30">
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase text-teal-400 font-bold mb-4 ml-3 tracking-[0.2em] opacity-80">Navigation</div>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold transition-all duration-200 group relative overflow-hidden uppercase tracking-wider",
              activeTab === item.id
                ? "bg-teal-700/50 text-white shadow-lg"
                : "text-teal-200/70 hover:bg-teal-800/50 hover:text-white"
            )}
          >
            <item.icon className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              activeTab === item.id ? "text-teal-300" : "text-teal-500 group-hover:text-teal-300"
            )} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-teal-700/50 bg-teal-950/40 mt-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-700/50 border border-teal-600/50 flex items-center justify-center text-teal-200 font-bold text-xs shadow-inner">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-white truncate uppercase tracking-tighter">Administrator</p>
            <p className="text-[9px] text-teal-400 font-mono truncate uppercase opacity-60">System Core</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
