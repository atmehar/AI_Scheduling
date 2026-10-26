'use client';

import React, { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';

export default function AIWaitlistModal({
  isOpen,
  onClose,
  provider,
  service,
  defaultDate,
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [preferredDate, setPreferredDate] = useState(
    defaultDate || new Date().toISOString().split('T')[0]
  );
  const [timeWindow, setTimeWindow] = useState('anytime');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const timeWindows = [
    { id: 'anytime', label: 'Any Time', desc: 'Any opening throughout the day' },
    { id: 'morning', label: 'Morning', desc: '08:00 AM – 12:00 PM' },
    { id: 'afternoon', label: 'Afternoon', desc: '12:00 PM – 05:00 PM' },
    { id: 'evening', label: 'Evening', desc: '05:00 PM – 09:00 PM' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      router.push(`/login?redirect=/providers/${provider?.id}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/ai/waitlist/', {
        provider_id: provider.id,
        service_id: service?.id || null,
        preferred_date: preferredDate,
        time_window: timeWindow,
      });
      setSuccess(true);
    } catch (err) {
      console.error('Waitlist registration failed:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Unable to join waitlist. Please verify the date and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccess(false);
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title="Join AI Standby Waitlist"
    >
      {success ? (
        <div className="text-center space-y-4 py-4">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white flex items-center justify-center mx-auto border border-zinc-200 dark:border-zinc-700">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-zinc-950 dark:text-white">
            Added to Standby Waitlist!
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
            Our AI cancellation monitor is active. As soon as a slot opens up with{' '}
            <strong className="text-zinc-950 dark:text-white">{provider?.display_name}</strong> on{' '}
            <strong className="text-zinc-950 dark:text-white">{preferredDate}</strong> ({timeWindow}), you will receive an instant high-priority notification to claim it.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="px-5 py-2.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
            <div className="p-2 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              No slots match your preferred schedule? Join the standby queue. The moment any booking is cancelled, our AI matches and alerts you instantly.
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Target Date:
            </label>
            <div className="relative">
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all"
              />
            </div>
          </div>

          {/* Time Window Preference */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Preferred Time Window:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {timeWindows.map((tw) => (
                <button
                  key={tw.id}
                  type="button"
                  onClick={() => setTimeWindow(tw.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    timeWindow === tw.id
                      ? 'border-zinc-950 dark:border-white bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-950 dark:ring-white'
                      : 'border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-400 bg-white dark:bg-zinc-900'
                  }`}
                >
                  <div className="text-xs font-semibold text-zinc-950 dark:text-white">
                    {tw.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {tw.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold rounded-xl shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 dark:border-zinc-900/40 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Join Standby Waitlist
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
