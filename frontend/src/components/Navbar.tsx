import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Wand2,
  Grid3X3,
  Building2,
  Moon,
  Sun,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'wizard' | 'seating' | 'manage';
  setActiveTab: (tab: 'dashboard' | 'wizard' | 'seating' | 'manage') => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  hasActivePlan: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  darkMode,
  setDarkMode,
  hasActivePlan,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground flex items-center gap-2">
              AutoSeat <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Pro</span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Exam Seating Arrangement System
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden md:inline">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'wizard'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span className="hidden md:inline">Generate Wizard</span>
          </button>

          <button
            onClick={() => setActiveTab('seating')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all relative ${
              activeTab === 'seating'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden md:inline">Seating Grid</span>
            {hasActivePlan && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'manage'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span className="hidden md:inline">Halls & Depts</span>
          </button>

          {/* Theme Toggle */}
          <div className="h-5 w-px bg-border mx-1" />
          <button
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle theme"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </nav>
      </div>
    </header>
  );
};
