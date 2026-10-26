'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Calendar,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Users,
  ChevronRight,
  Zap,
  Mail,
  Bell,
  FileText,
} from 'lucide-react';
import AIConciergeModal from '@/components/ai/AIConciergeModal';

export default function HomePage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);

  useEffect(() => {
    const fetchFeaturedProviders = async () => {
      try {
        const res = await api.get('/providers/');
        const list = res.data.results || res.data || [];
        setProviders(list.slice(0, 3));
      } catch (err) {
        console.error('Error fetching providers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeaturedProviders();
  }, []);

  return (
    <div className="flex flex-col space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-zinc-400/10 dark:bg-zinc-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          <span>Zero Double-Booking Guarantee</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white max-w-4xl mx-auto leading-tight">
          Next-Generation Scheduling for{' '}
          <span className="underline decoration-zinc-400 dark:decoration-zinc-600 underline-offset-8">
            Fast-Moving Professionals
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Book appointments without the back-and-forth email tag. Backed by PostgreSQL exclusion constraints, dynamic timezone math, and automated reminder queues.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/providers"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 font-semibold text-base shadow-lg shadow-zinc-900/10 dark:shadow-none transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>Book an Appointment</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 font-semibold text-base border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all flex items-center justify-center"
          >
            Create Provider Account
          </Link>
        </div>

        {/* Feature Highlights Banner */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base mb-1">
              Zero Overlaps
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Database-level PostgreSQL exclusion constraints eliminate race conditions and double-bookings forever.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base mb-1">
              Timezone Intelligence
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Seamless cross-timezone slot generation. Clients see times in their local timezone, providers in theirs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base mb-1">
              Auto Reminders
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Reliable 24-hour and 1-hour notifications scheduled on confirmation, resiliently handled via worker queues.
            </p>
          </div>
        </div>
      </section>

      {/* AI Intelligence Architecture Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-zinc-950 text-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Scheduling Intelligence Suite</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
              Four Specialized AI Systems Working in Harmony
            </h2>
            <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
              From natural language slot discovery to automated pre-meeting briefing briefs, smart cancellation recovery, and post-session follow-ups.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsConciergeOpen(true)}
                className="px-6 py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 font-semibold text-sm inline-flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Try AI Booking Concierge</span>
              </button>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="p-2 w-fit rounded-lg bg-white/10 text-white">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="font-bold text-sm text-white">1. NLP Smart Concierge</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Parse natural language search phrases and directly recommend verified conflict-free slots.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="p-2 w-fit rounded-lg bg-white/10 text-white">
                <FileText className="w-4 h-4 text-sky-400" />
              </div>
              <h4 className="font-bold text-sm text-white">2. Pre-Meeting Briefing</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Transforms intake notes into executive summaries, 30-min agendas, and prep checklists.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="p-2 w-fit rounded-lg bg-white/10 text-white">
                <Bell className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="font-bold text-sm text-white">3. Cancellation Recovery</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Instant standby waitlist matching alerts clients immediately when cancellations happen.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="p-2 w-fit rounded-lg bg-white/10 text-white">
                <Mail className="w-4 h-4 text-violet-400" />
              </div>
              <h4 className="font-bold text-sm text-white">4. Follow-up Generator</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Post-meeting structured summaries, action items with deadlines, and 1-click email delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Providers Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white">Featured Providers</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Select a specialist to view real-time availability
            </p>
          </div>
          <Link
            href="/providers"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 hover:text-black dark:hover:text-white flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-48 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : providers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {providers.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between hover:shadow-lg hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
              >
                <div>
                  <div className="flex items-center space-x-3 mb-3 min-w-0 flex-1">
                    <div className="w-12 h-12 min-w-12 min-h-12 shrink-0 aspect-square rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold flex items-center justify-center text-lg shadow-sm select-none">
                      {p.display_name?.slice(0, 1) || 'P'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-zinc-950 dark:text-white text-base leading-snug line-clamp-1" title={p.display_name}>
                        {p.display_name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.timezone}</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4">
                    {p.bio || 'Professional services provider available for consultations.'}
                  </p>
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {p.active_services_count || 1} Services available
                  </span>
                  <Link
                    href={`/providers/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold transition-colors"
                  >
                    <span>Book Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
            <Users className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
              No Providers Registered Yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Be the first provider on the platform! Sign up and set your services and working hours.
            </p>
            <Link
              href="/register"
              className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 font-medium text-sm transition-colors"
            >
              Register as Provider
            </Link>
          </div>
        )}
      </section>

      {/* Feature 1: AI Booking Concierge Modal */}
      <AIConciergeModal
        isOpen={isConciergeOpen}
        onClose={() => setIsConciergeOpen(false)}
      />
    </div>
  );
}
