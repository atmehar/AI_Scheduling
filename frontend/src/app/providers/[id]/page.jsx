'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import SlotPicker from '@/components/booking/SlotPicker';
import {
  Clock,
  Globe,
  Shield,
  ArrowLeft,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function ProviderBookingPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params?.id;

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!providerId) return;

    const fetchProvider = async () => {
      try {
        const res = await api.get(`/providers/${providerId}/`);
        setProvider(res.data);
      } catch (err) {
        console.error('Error fetching provider profile:', err);
        setError('Provider not found or currently unavailable.');
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [providerId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 w-full space-y-6">
        <div className="h-40 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
        <div className="h-96 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-950 dark:text-white">Provider Unavailable</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 mb-6">{error || 'Could not load details.'}</p>
        <Link
          href="/providers"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 font-medium text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/providers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Providers</span>
        </Link>
      </div>

      {/* Provider Header Profile Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 min-w-16 min-h-16 shrink-0 aspect-square rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold flex items-center justify-center text-2xl shadow-md shadow-zinc-950/15 select-none">
              {provider.display_name?.slice(0, 1) || 'P'}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white">
                {provider.display_name}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
                {provider.bio || 'Professional appointments and consultation.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-col items-start md:items-end gap-2 text-xs text-zinc-500 dark:text-zinc-400 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 dark:border-zinc-800">
            <span className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Provider TZ: <strong className="text-zinc-900 dark:text-zinc-100">{provider.timezone}</strong></span>
            </span>
            <span className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Min notice: <strong className="text-zinc-900 dark:text-zinc-100">{provider.min_notice_minutes} mins</strong></span>
            </span>
            <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-medium">
              <Shield className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>Cancel window: {provider.cancellation_hours}h</span>
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Slot Booking Engine */}
      <div>
        <h2 className="text-lg font-bold text-zinc-950 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
          <span>Select an Appointment Slot</span>
        </h2>
        <SlotPicker provider={provider} />
      </div>
    </div>
  );
}
