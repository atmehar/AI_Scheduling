'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Bell,
  CheckCircle,
  Clock,
  Calendar,
  XCircle,
  Mail,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function NotificationBell() {
  const { user, isProvider } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/notifications/');
      setNotifications(res.data.results || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.warn('Failed to load notifications feed:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const timer = setInterval(fetchNotifications, 30000);
      return () => clearInterval(timer);
    }
  }, [user]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!user) return null;

  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'booking_request':
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'booking_confirmed':
        return <CheckCircle className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />;
      case 'booking_completed':
        return <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'reminder':
        return <Mail className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />;
      case 'booking_cancelled':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      default:
        return <Calendar className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getBgColor = (type) => {
    switch (type) {
      case 'booking_request':
        return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40';
      case 'booking_confirmed':
        return 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
      case 'booking_completed':
        return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40';
      case 'reminder':
        return 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700';
      case 'booking_cancelled':
        return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        aria-label="View notifications"
        className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[17px] h-[17px] px-1 text-[9px] font-extrabold text-white bg-zinc-950 dark:bg-white dark:text-zinc-950 rounded-full ring-2 ring-white dark:ring-zinc-950 animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-zinc-950/20 border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950/80 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {unreadCount} pending
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchNotifications}
                disabled={loading}
                title="Refresh"
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <div className="w-5 h-5 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Checking notifications...</p>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 flex items-start gap-3 ${
                    item.is_pending_action ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${getBgColor(
                      item.type
                    )}`}
                  >
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{item.title}</p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                        {formatDateTime(item.created_at, user?.timezone)}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-snug line-clamp-2">
                      {item.message}
                    </p>

                    {item.is_pending_action && isProvider && (
                      <div className="pt-1.5">
                        <Link
                          href="/dashboard"
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-0.5 rounded-md transition-colors"
                        >
                          Review in Appointments
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No Notifications</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  Real-time alerts and reminders will appear here.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 dark:text-zinc-500 text-center flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white animate-pulse" />
            <span>PostgreSQL SKIP LOCKED Background Engine Active</span>
          </div>
        </div>
      )}
    </div>
  );
}
