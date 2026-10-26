'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Search, MapPin, Clock, ArrowRight, Shield, User, Sparkles } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import AIConciergeModal from '@/components/ai/AIConciergeModal';

export default function ProvidersDirectoryPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await api.get('/providers/');
        const list = res.data.results || res.data || [];
        setProviders(list);
      } catch (err) {
        console.error('Failed to load providers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  const filteredProviders = providers.filter((p) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = p.display_name?.toLowerCase().includes(q);
    const bioMatch = p.bio?.toLowerCase().includes(q);
    return nameMatch || bioMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* AI Concierge Trigger Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950 text-white dark:bg-zinc-900 border border-zinc-800 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Smart Booking Concierge</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Need an appointment without manual searching?
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
            Type your request in plain English (e.g. &ldquo;Find me a 30-min legal consultation with Alex next Tuesday afternoon&rdquo;). Our AI parses schedules and returns verified slots instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsConciergeOpen(true)}
          className="px-5 py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-white dark:text-zinc-950 font-semibold text-xs md:text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-all flex-shrink-0"
        >
          <Sparkles className="w-4 h-4 text-zinc-950" />
          <span>Launch AI Concierge</span>
        </button>
      </div>

      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Browse Service Providers
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Discover verified professionals and reserve open slots instantaneously.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search providers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-750 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20 focus:border-zinc-950 dark:focus:border-white text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
        </div>
      </div>

      <AIConciergeModal
        isOpen={isConciergeOpen}
        onClose={() => setIsConciergeOpen(false)}
      />

      {/* Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-56 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredProviders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => (
            <div
              key={provider.id}
              className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-12 h-12 min-w-12 min-h-12 shrink-0 aspect-square rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold flex items-center justify-center text-lg shadow-sm select-none">
                      {provider.display_name?.slice(0, 1) || 'P'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-zinc-950 dark:text-white text-base leading-snug line-clamp-2" title={provider.display_name}>
                        {provider.display_name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 shrink-0" /> <span className="truncate">{provider.timezone}</span>
                      </p>
                    </div>
                  </div>
                  <Badge status="provider" text="Verified" />
                </div>

                <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-3 mb-4">
                  {provider.bio || 'Available for professional consultation and appointments.'}
                </p>

                <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-6 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between">
                    <span>Min Notice:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-200">
                      {provider.min_notice_minutes} mins
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Free Cancel Window:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-200">
                      Up to {provider.cancellation_hours}h prior
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href={`/providers/${provider.id}`}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01]"
              >
                <span>View Availability</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <User className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
            No Providers Found
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {searchQuery
              ? `No provider matches "${searchQuery}". Try a different keyword.`
              : 'There are currently no registered providers.'}
          </p>
        </div>
      )}
    </div>
  );
}
