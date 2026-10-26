'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUserDefaultTimezone, formatCurrency } from '@/lib/utils';
import {
  Sparkles,
  Search,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  User,
  Zap,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';

export default function AIConciergeModal({ isOpen, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const quickPrompts = [
    'Find me a 30-min legal consultation with Alex next Tuesday afternoon',
    'UX design audit with Claire Bennett tomorrow morning',
    'Health consultation with Tariq Friday afternoon',
    'Quickest 15-min consultation available this week',
  ];

  const handleSearch = async (promptText) => {
    const textToSearch = promptText || query;
    if (!textToSearch.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const tz = getUserDefaultTimezone();
      const res = await api.post('/ai/concierge/', {
        query: textToSearch,
        timezone: tz,
      });
      setResult(res.data);
    } catch (err) {
      console.error('AI Concierge error:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Unable to process your scheduling request. Please rephrase or specify a provider name.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = (providerId, serviceId, slot) => {
    onClose();
    // Navigate to provider profile with pre-selected service and date
    const datePart = slot.start_at.split('T')[0];
    router.push(`/providers/${providerId}?service=${serviceId}&date=${datePart}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Smart Booking Concierge"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Header intro */}
        <div className="flex items-start gap-3 p-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
          <div className="p-2 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Natural Language Booking Assistant
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Tell me what you need (e.g. &ldquo;30-min legal consultation with Alex next Tuesday afternoon&rdquo;) and I will find conflict-free openings instantly.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="space-y-3"
        >
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Find 30 min with Alex next Tuesday after 2 PM..."
              className="w-full pl-4 pr-12 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt Chips */}
          <div className="space-y-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Quick examples:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(p);
                    handleSearch(p);
                  }}
                  className="text-xs px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition-colors border border-zinc-200/60 dark:border-zinc-700/60"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-8 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-zinc-950 dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Parsing query, validating provider working schedules, and calculating verified slots...
            </p>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results view */}
        {result && (
          <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {/* Parsed summary badges */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {result.provider?.display_name}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {result.service?.name} ({result.service?.duration_minutes}m)
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {result.target_date}
              </Badge>
              {result.time_preference && (
                <Badge variant="secondary" className="capitalize">
                  {result.time_preference.replace('_', ' ')}
                </Badge>
              )}
            </div>

            {/* AI explanation */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60">
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {result.conversational_reply || result.explanation}
              </p>
            </div>

            {/* Suggested slots */}
            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Recommended Slots ({result.suggested_slots?.length || 0} Openings)
              </h5>

              {result.suggested_slots && result.suggested_slots.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {result.suggested_slots.map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        handleSelectSlot(
                          result.provider?.id,
                          result.service?.id,
                          slot
                        )
                      }
                      className="p-3 text-left bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700/80 transition-all hover:border-zinc-950 dark:hover:border-white group flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-zinc-950 dark:text-white">
                          {slot.display_date}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatCurrency(result.service?.price_amount, result.service?.currency)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          {slot.display_time}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-950 dark:text-white font-medium group-hover:underline">
                          Select <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
                  No direct slot matches found for the requested time frame.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
