'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  Clock,
  Menu,
  X,
  LogOut,
  Layers,
  CalendarCheck,
  Sparkles,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import AIConciergeModal from '@/components/ai/AIConciergeModal';

export default function Navbar() {
  const pathname = usePathname();
  const { user, isProvider, isCustomer, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);

  const isActive = (path) => pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full glass-nav border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white">
                TimeSync
              </span>
              <span className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500 dark:text-zinc-400 -mt-0.5">
                AI Scheduling
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <Link
              href="/providers"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive('/providers')
                  ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900'
              }`}
            >
              Browse Providers
            </Link>

            <button
              type="button"
              onClick={() => setIsConciergeOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 dark:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 transition-colors shadow-sm"
              title="Launch AI Booking Concierge"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Concierge</span>
            </button>

            {isCustomer && (
              <Link
                href="/my-bookings"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive('/my-bookings')
                    ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>My Bookings</span>
              </Link>
            )}

            {isProvider && (
              <>
                <Link
                  href="/dashboard"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive('/dashboard')
                      ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900'
                  }`}
                >
                  Appointments
                </Link>
                <Link
                  href="/dashboard/services"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    isActive('/dashboard/services')
                      ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Services</span>
                </Link>
                <Link
                  href="/dashboard/availability"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    isActive('/dashboard/availability')
                      ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Hours & Time-Off</span>
                </Link>
              </>
            )}
          </nav>

          {/* User actions */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Dark / Light Mode Switcher */}
            <ThemeToggle />

            {user ? (
              <div className="flex items-center space-x-2">
                <NotificationBell />

                {/* Avatar with letters ONLY (Email and Title/Role removed per user request) */}
                <div
                  className="pl-2 border-l border-zinc-200 dark:border-zinc-800"
                  title={`${user.email} (${user.role})`}
                >
                  <div className="w-8 h-8 min-w-8 min-h-8 shrink-0 aspect-square rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-sm select-none">
                    {user.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-950 dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg shadow-sm transition-all hover:scale-[1.02]"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu, theme toggle and notifications */}
          <div className="flex md:hidden items-center space-x-1">
            <ThemeToggle />
            {user && <NotificationBell />}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 pt-2 pb-6 space-y-3">
          <Link
            href="/providers"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Browse Providers
          </Link>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setIsConciergeOpen(true);
            }}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Booking Concierge</span>
          </button>

          {isCustomer && (
            <Link
              href="/my-bookings"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              My Bookings
            </Link>
          )}

          {isProvider && (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Appointments Dashboard
              </Link>
              <Link
                href="/dashboard/services"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Service Catalog
              </Link>
              <Link
                href="/dashboard/availability"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Hours & Time-Off
              </Link>
            </>
          )}

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {user ? (
              <div className="flex items-center justify-between px-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 min-w-8 min-h-8 shrink-0 aspect-square rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs ring-2 ring-zinc-200 dark:ring-zinc-800 select-none">
                    {user.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="px-3 py-1 text-xs text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center w-full py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center w-full py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature 1: Natural Language Smart Booking Concierge */}
      <AIConciergeModal
        isOpen={isConciergeOpen}
        onClose={() => setIsConciergeOpen(false)}
      />
    </header>
  );
}
