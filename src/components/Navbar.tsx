import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, Sun, Moon, LogIn, Shield, Menu, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isCurrent = (path: string) => location.pathname === path;
  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b-[0.5px] border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-[20px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 group" onClick={closeMenu}>
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent)]">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-display font-bold tracking-tight text-[var(--text)]">
                VALVE AI <span className="text-[var(--accent)]">PRO</span>
              </span>
            </Link>
            
            {user && (
              <nav className="hidden md:flex items-center gap-1">
                {[
                  { path: '/dashboard', label: 'Dashboard' },
                  { path: '/upload', label: 'Upload RFQ' },
                  { path: '/catalogue', label: 'Catalogue' },
                  { path: '/rules', label: 'Rules' },
                  { path: '/test', label: 'Test' },
                  { path: '/profile', label: 'Profile' }
                ].map(item => (
                  <Link 
                    key={item.path}
                    to={item.path} 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isCurrent(item.path) 
                        ? 'bg-[rgba(34,197,94,0.1)] text-[var(--accent)]' 
                        : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg3)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link 
                    to="/admin" 
                    className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isCurrent('/admin') 
                        ? 'bg-red-500/10 text-red-500' 
                        : 'text-red-500/70 hover:text-red-500 hover:bg-red-500/10 animate-pulse'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </Link>
                )}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full text-[var(--text3)] hover:bg-[var(--bg3)] hover:text-[var(--text)] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:block text-sm text-[var(--text3)]">
                  {user.email}
                </div>
                <button 
                  onClick={signOut}
                  className="v-btn-ghost px-3 py-2 sm:px-4 text-sm font-medium"
                >
                  Sign Out
                </button>
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg text-[var(--text3)] hover:bg-[var(--bg3)] transition-colors"
                  aria-label="Toggle mobile menu"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            ) : (
              <Link 
                to="/auth"
                className="v-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {user && isMobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {[
              { path: '/dashboard', label: 'Dashboard' },
              { path: '/upload', label: 'Upload RFQ' },
              { path: '/catalogue', label: 'Catalogue' },
              { path: '/rules', label: 'Rules' },
              { path: '/test', label: 'Test' },
              { path: '/profile', label: 'Profile' }
            ].map(item => (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={closeMenu}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                  isCurrent(item.path) 
                    ? 'bg-[rgba(34,197,94,0.1)] text-[var(--accent)] border-l-4 border-[var(--accent)]' 
                    : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg3)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link 
                to="/admin" 
                onClick={closeMenu}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                  isCurrent('/admin') 
                    ? 'bg-red-500/10 text-red-500 border-l-4 border-red-500' 
                    : 'text-red-500/70 hover:text-red-500 hover:bg-red-500/10'
                }`}
              >
                <Shield className="w-5 h-5" />
                Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
