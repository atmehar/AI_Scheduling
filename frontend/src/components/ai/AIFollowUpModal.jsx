'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Mail,
  Sparkles,
  Send,
  CheckCircle,
  AlertCircle,
  ListTodo,
  Clock,
  Calendar,
  Check,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';

export default function AIFollowUpModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}) {
  const [roughNotes, setRoughNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [followupData, setFollowupData] = useState(null);
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    if (isOpen && booking) {
      setRoughNotes('');
      setFollowupData(null);
      setError('');
      setIsSent(false);
    }
  }, [isOpen, booking]);

  const handleGenerate = async () => {
    if (!booking?.id) return;
    setGenerating(true);
    setError('');

    try {
      const res = await api.post('/ai/meeting-followup/generate/', {
        booking_id: booking.id,
        rough_notes: roughNotes,
      });
      setFollowupData(res.data);
      if (res.data.is_sent) {
        setIsSent(true);
      }
    } catch (err) {
      console.error('Failed to generate follow-up:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to generate follow-up draft.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!followupData?.id) return;
    setSending(true);
    setError('');

    try {
      await api.post(`/ai/meeting-followup/${followupData.id}/send/`);
      setIsSent(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to send follow-up email:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to dispatch follow-up email.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Post-Meeting Action Items & Follow-up"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Header summary */}
        <div className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 text-xs">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Client: </span>
            <span className="font-semibold text-zinc-950 dark:text-white">
              {booking?.customer_name || booking?.customer?.email}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Service: </span>
            <span className="font-semibold text-zinc-950 dark:text-white">
              {booking?.service_name || booking?.service?.name}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isSent ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
              Follow-Up Email Successfully Dispatched!
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
              The structured summary and action items have been delivered to the client&rsquo;s inbox and notifications feed.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold rounded-xl hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step 1: Provider Takeaway Notes Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Provider Takeaways / Key Points (Optional):
              </label>
              <textarea
                rows={3}
                value={roughNotes}
                onChange={(e) => setRoughNotes(e.target.value)}
                placeholder="e.g. Agreed on quarterly milestone review. Client will submit security checklist by next Friday..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all"
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  AI synthesizes notes with appointment metadata to write your email.
                </span>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {generating ? 'Synthesizing...' : 'Generate AI Draft'}
                </button>
              </div>
            </div>

            {/* Step 2: Generated Email Preview & Action Items */}
            {followupData && (
              <div className="space-y-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                {/* Subject */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Subject Line:
                  </span>
                  <input
                    type="text"
                    value={followupData.email_subject}
                    onChange={(e) =>
                      setFollowupData({
                        ...followupData,
                        email_subject: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold text-zinc-950 dark:text-white"
                  />
                </div>

                {/* Structured Action Items */}
                {followupData.action_items && followupData.action_items.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <ListTodo className="w-3.5 h-3.5" />
                      Structured Action Items:
                    </span>
                    <div className="space-y-1.5">
                      {followupData.action_items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700/70 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {item.task}
                            </span>
                            <div className="text-[10px] text-zinc-500">
                              Owner: <span className="font-semibold">{item.owner}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {item.deadline}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email Body */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Draft Message:
                  </span>
                  <textarea
                    rows={6}
                    value={followupData.email_body}
                    onChange={(e) =>
                      setFollowupData({
                        ...followupData,
                        email_body: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 font-mono leading-relaxed"
                  />
                </div>

                {/* Send action button */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={handleSend}
                    className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold rounded-xl shadow-md flex items-center gap-2 disabled:opacity-60"
                  >
                    {sending ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/40 dark:border-zinc-900/40 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                        Dispatching Email...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send Follow-Up Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
