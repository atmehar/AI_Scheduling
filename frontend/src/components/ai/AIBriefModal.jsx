'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  FileText,
  Clock,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  AlertCircle,
  User,
  Calendar,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';

export default function AIBriefModal({ isOpen, onClose, booking }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    if (isOpen && booking?.id) {
      fetchBrief(booking.id);
    } else {
      setBrief(null);
      setError('');
      setCheckedItems({});
    }
  }, [isOpen, booking?.id]);

  const fetchBrief = async (bookingId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/ai/intake-brief/${bookingId}/`);
      setBrief(res.data);
    } catch (err) {
      console.error('Failed to fetch AI brief:', err);
      setError('Unable to load Executive Brief. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!booking?.id) return;
    setRegenerating(true);
    setError('');
    try {
      const res = await api.post(`/ai/intake-brief/${booking.id}/`, {});
      setBrief(res.data);
    } catch (err) {
      console.error('Failed to regenerate brief:', err);
      setError('Failed to refresh brief.');
    } finally {
      setRegenerating(false);
    }
  };

  const toggleCheck = (idx) => {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Pre-Meeting Consultation Brief"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Header context */}
        <div className="flex items-center justify-between p-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Appointment #{booking?.id}</div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                {booking?.service_name || booking?.service?.name} with {booking?.customer_name || booking?.customer?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating || loading}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            title="Refresh AI Brief"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-zinc-950 dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Analyzing consultation scope and synthesizing Executive Brief...
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {brief && !loading && (
          <div className="space-y-5">
            {/* Client Intake Notes (Raw) */}
            {brief.client_notes && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Client Intake Notes:
                </span>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-700 dark:text-zinc-300 italic">
                  &ldquo;{brief.client_notes}&rdquo;
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                AI Executive Summary:
              </span>
              <div className="p-3.5 bg-zinc-100/70 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                {brief.executive_summary}
              </div>
            </div>

            {/* 30-min Timed Agenda Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                30-Minute Consultation Agenda:
              </span>
              <div className="space-y-2">
                {brief.agenda_items &&
                  brief.agenda_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700/80 flex items-start gap-3"
                    >
                      <Badge variant="outline" className="font-mono text-[11px] whitespace-nowrap mt-0.5">
                        {item.time_slot}
                      </Badge>
                      <div className="space-y-0.5">
                        <h6 className="text-xs font-semibold text-zinc-950 dark:text-white">
                          {item.title}
                        </h6>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {item.objective}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Preparation Checklist */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                Provider Pre-Session Checklist:
              </span>
              <div className="space-y-1.5">
                {brief.checklist &&
                  brief.checklist.map((item, idx) => {
                    const isChecked = checkedItems[idx] || false;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleCheck(idx)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center gap-2.5 transition-all ${
                          isChecked
                            ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-600 line-through text-zinc-400 dark:text-zinc-500'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/70 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-zinc-950 dark:text-white flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        )}
                        <span>{item}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
