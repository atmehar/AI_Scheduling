'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  TrendingUp,
  AlertCircle,
  Layers,
  Settings,
  ArrowRight,
  Sparkles,
  Mail,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AIBriefModal from '@/components/ai/AIBriefModal';
import AIFollowUpModal from '@/components/ai/AIFollowUpModal';

export default function ProviderDashboardPage() {
  const router = useRouter();
  const { user, isProvider, loading: authLoading } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'confirmed' | 'completed'
  const [acceptingId, setAcceptingId] = useState(null);

  // Action states
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionType, setActionType] = useState(null); // 'complete' | 'cancel'
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // AI Feature States
  const [selectedBriefBooking, setSelectedBriefBooking] = useState(null);
  const [selectedFollowUpBooking, setSelectedFollowUpBooking] = useState(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings/');
      const list = res.data.results || res.data || [];
      setBookings(list);
    } catch (err) {
      console.error('Error fetching dashboard bookings:', err);
      setError('Failed to fetch provider appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || !isProvider)) {
      router.push('/login?redirect=/dashboard');
      return;
    }
    if (user && isProvider) {
      fetchBookings();
    }
  }, [user, isProvider, authLoading]);

  const getErrorMessage = (err, fallback) => {
    const data = err?.response?.data;
    if (!data) return err?.message || fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.join(' ');
    if (typeof data.error === 'string') return data.error;
    if (typeof data.message === 'string') return data.message;
    return fallback;
  };

  // Handle Accept Booking
  const handleAcceptBooking = async (bookingId) => {
    setAcceptingId(bookingId);
    setActionError('');
    try {
      await api.post(`/bookings/${bookingId}/accept/`);
      await fetchBookings();
      setSelectedBooking(null);
      setActionType(null);
    } catch (err) {
      console.error('Error accepting booking:', err);
      setActionError(getErrorMessage(err, 'Failed to accept booking request.'));
    } finally {
      setAcceptingId(null);
    }
  };

  // Handle Complete
  const handleCompleteBooking = async () => {
    if (!selectedBooking) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.post(`/bookings/${selectedBooking.id}/complete/`);
      const completed = selectedBooking;
      setSelectedBooking(null);
      setActionType(null);
      fetchBookings();
      // Prompt provider to dispatch AI follow-up email
      setSelectedFollowUpBooking(completed);
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err, 'Failed to complete appointment.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel / Decline
  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.post(`/bookings/${selectedBooking.id}/cancel/`, {
        reason: cancelReason || (selectedBooking.status === 'pending' ? 'Declined by provider' : 'Cancelled by provider'),
      });
      setSelectedBooking(null);
      setActionType(null);
      setCancelReason('');
      fetchBookings();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err, 'Failed to cancel appointment.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Compute metrics
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter((b) => b.status === 'pending').length;
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const completedBookings = bookings.filter((b) => b.status === 'completed').length;
  const cancelledBookings = bookings.filter((b) =>
    ['cancelled', 'late_cancelled'].includes(b.status)
  ).length;

  const filteredBookings = bookings.filter((b) => {
    if (filterTab === 'all') return true;
    if (filterTab === 'pending') return b.status === 'pending';
    if (filterTab === 'confirmed') return b.status === 'confirmed';
    if (filterTab === 'completed') return b.status === 'completed';
    if (filterTab === 'cancelled') return ['cancelled', 'late_cancelled'].includes(b.status);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Provider Dashboard
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Real-time appointment schedule, customer interactions, and availability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/services"
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
            <span>Manage Services</span>
          </Link>
          <Link
            href="/dashboard/availability"
            className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Hours & Time-Off</span>
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <button
          onClick={() => setFilterTab('pending')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            filterTab === 'pending'
              ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 ring-2 ring-amber-400/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pending Requests</p>
            {pendingBookings > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                Action Req.
              </span>
            )}
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
            {pendingBookings}
          </h3>
        </button>

        <button
          onClick={() => setFilterTab('confirmed')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            filterTab === 'confirmed'
              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 ring-2 ring-zinc-400/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
          }`}
        >
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Confirmed Active</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white mt-2">
            {confirmedBookings}
          </h3>
        </button>

        <button
          onClick={() => setFilterTab('completed')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            filterTab === 'completed'
              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 ring-2 ring-zinc-400/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
          }`}
        >
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Completed</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white mt-2">
            {completedBookings}
          </h3>
        </button>

        <button
          onClick={() => setFilterTab('all')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            filterTab === 'all'
              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 ring-2 ring-zinc-400/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
          }`}
        >
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Bookings</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white mt-2">
            {totalBookings}
          </h3>
        </button>
      </div>

      {/* Appointments List Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Navigation Filters & Controls */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: 'all', label: 'All', count: totalBookings },
              { key: 'pending', label: 'Pending Approval', count: pendingBookings },
              { key: 'confirmed', label: 'Confirmed', count: confirmedBookings },
              { key: 'completed', label: 'Completed', count: completedBookings },
              { key: 'cancelled', label: 'Cancelled', count: cancelledBookings },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                  filterTab === tab.key
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    filterTab === tab.key
                      ? 'bg-white/20 text-white dark:bg-zinc-950/20 dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={fetchBookings}
            className="text-xs text-zinc-950 dark:text-white hover:underline font-semibold self-end sm:self-auto"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredBookings.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredBookings.map((booking) => {
              const isPending = booking.status === 'pending';
              const isConfirmed = booking.status === 'confirmed';
              const isCompleted = booking.status === 'completed';
              const isCancelled = ['cancelled', 'late_cancelled'].includes(booking.status);

              return (
                <div
                  key={booking.id}
                  className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-zinc-950 dark:text-white text-sm">
                        {booking.service?.name}
                      </span>
                      <Badge status={booking.status} />
                      {isPending && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 animate-pulse">
                          Awaiting Your Approval
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                        Customer: <strong className="text-zinc-800 dark:text-zinc-200">{booking.customer?.email}</strong>
                      </span>
                      <span className="flex items-center gap-1 font-medium text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        {formatDateTime(booking.start_at, user?.timezone)}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(booking.service?.price_amount, booking.service?.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                    {/* Feature 2: AI Pre-Meeting Brief */}
                    <button
                      type="button"
                      onClick={() => setSelectedBriefBooking(booking)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-750 transition-colors"
                      title="View AI Executive Consultation Brief & Agenda"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>AI Brief</span>
                    </button>

                    {/* State 1: Pending -> Provider can Accept or Decline */}
                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={acceptingId === booking.id}
                          onClick={() => handleAcceptBooking(booking.id)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                        >
                          {acceptingId === booking.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setActionType('cancel');
                            setActionError('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-xs font-semibold flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </>
                    )}

                    {/* State 2: Confirmed -> Provider can Complete or Cancel */}
                    {isConfirmed && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setActionType('complete');
                            setActionError('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setActionType('cancel');
                            setActionError('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-xs font-semibold flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    {/* Feature 4: Post-Meeting AI Follow-up (Available on completed & confirmed bookings) */}
                    {(isCompleted || isConfirmed) && (
                      <button
                        type="button"
                        onClick={() => setSelectedFollowUpBooking(booking)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 transition-colors"
                        title="Generate or Send Post-Meeting Action Items & Email"
                      >
                        <Mail className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
                        <span>Follow-up</span>
                      </button>
                    )}

                    {/* State 3: Completed badge */}
                    {isCompleted && (
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <CheckCircle className="w-3.5 h-3.5" /> Fulfilled
                      </span>
                    )}

                    {/* State 4: Cancelled */}
                    {isCancelled && (
                      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-14 p-6">
            <Calendar className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Appointments In This View</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {filterTab === 'pending'
                ? 'No pending booking requests awaiting approval.'
                : 'Appointments will appear here in real-time as customers book slots.'}
            </p>
          </div>
        )}
      </div>

      {/* Action Confirmation Modal */}
      <Modal
        isOpen={!!selectedBooking}
        onClose={() => {
          setSelectedBooking(null);
          setActionType(null);
        }}
        title={
          actionType === 'complete' ? 'Mark Appointment Complete' : 'Cancel Appointment'
        }
      >
        <div className="space-y-4">
          {actionType === 'complete' && selectedBooking?.status === 'pending' ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>This appointment is awaiting your approval</span>
              </p>
              <p className="text-slate-600">
                Per scheduling policy, an appointment must first be accepted into confirmed status before it can be fulfilled as completed.
              </p>
              <button
                type="button"
                disabled={acceptingId === selectedBooking.id}
                onClick={() => handleAcceptBooking(selectedBooking.id)}
                className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
              >
                {acceptingId === selectedBooking.id ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                <span>Accept Booking Now</span>
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {actionType === 'complete'
                ? `Are you sure you want to mark appointment #${selectedBooking?.id} for ${selectedBooking?.customer?.email} as completed?`
                : `Are you sure you want to cancel appointment #${selectedBooking?.id} for ${selectedBooking?.customer?.email}?`}
            </p>
          )}

          {actionType === 'cancel' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Reason for Cancellation
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Provider requested cancellation..."
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {actionError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setSelectedBooking(null);
                setActionType(null);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-600"
            >
              Back
            </button>
            {actionType === 'complete' && selectedBooking?.status === 'pending' ? null : (
              <button
                type="button"
                disabled={actionLoading}
                onClick={
                  actionType === 'complete'
                    ? handleCompleteBooking
                    : handleCancelBooking
                }
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 ${
                  actionType === 'complete'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Feature 2: AI Pre-Meeting Briefing Modal */}
      <AIBriefModal
        isOpen={!!selectedBriefBooking}
        onClose={() => setSelectedBriefBooking(null)}
        booking={selectedBriefBooking}
      />

      {/* Feature 4: AI Post-Meeting Action Items & Follow-up Generator Modal */}
      <AIFollowUpModal
        isOpen={!!selectedFollowUpBooking}
        onClose={() => setSelectedFollowUpBooking(null)}
        booking={selectedFollowUpBooking}
        onSuccess={() => fetchBookings()}
      />
    </div>
  );
}
