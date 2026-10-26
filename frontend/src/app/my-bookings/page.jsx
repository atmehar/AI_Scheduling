'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDateTime, formatCurrency, getUserDefaultTimezone } from '@/lib/utils';
import {
  Calendar,
  Clock,
  User,
  AlertTriangle,
  RotateCcw,
  XCircle,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  Bell,
  Sparkles,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cancel Modal state
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Reschedule Modal state
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [rescheduleDate, setRescheduleDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedNewSlot, setSelectedNewSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings/');
      const list = res.data.results || res.data || [];
      setBookings(list);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const res = await api.get('/ai/waitlist/');
      setWaitlistEntries(res.data || []);
    } catch (err) {
      console.error('Error fetching waitlist:', err);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/my-bookings');
      return;
    }
    if (user) {
      fetchBookings();
      fetchWaitlist();
    }
  }, [user, authLoading]);

  // Handle Cancel Submit
  const handleConfirmCancel = async () => {
    if (!cancelBooking) return;
    setIsCancelling(true);
    setCancelError('');

    try {
      await api.post(`/bookings/${cancelBooking.id}/cancel/`, {
        reason: cancelReason || 'Customer requested cancellation',
      });
      setCancelBooking(null);
      setCancelReason('');
      fetchBookings();
    } catch (err) {
      console.error('Cancel failed:', err);
      setCancelError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to cancel booking.'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Fetch Slots for Rescheduling
  const fetchRescheduleSlots = async (providerId, serviceId, date) => {
    setLoadingSlots(true);
    setRescheduleError('');
    try {
      const res = await api.get(`/providers/${providerId}/slots/`, {
        params: {
          service_id: serviceId,
          from: date,
          to: date,
          tz: user?.timezone || getUserDefaultTimezone(),
        },
      });
      setAvailableSlots(res.data.slots || []);
    } catch (err) {
      console.error(err);
      setRescheduleError('Failed to load open slots for selected date.');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const openRescheduleModal = (booking) => {
    setRescheduleBooking(booking);
    setSelectedNewSlot(null);
    setRescheduleError('');
    const today = new Date().toISOString().split('T')[0];
    setRescheduleDate(today);
    fetchRescheduleSlots(booking.provider.id, booking.service.id, today);
  };

  // Handle Reschedule Submit
  const handleConfirmReschedule = async () => {
    if (!rescheduleBooking || !selectedNewSlot) return;
    setIsRescheduling(true);
    setRescheduleError('');

    try {
      await api.post(`/bookings/${rescheduleBooking.id}/reschedule/`, {
        start_at: selectedNewSlot.start_at,
      });
      setRescheduleBooking(null);
      setSelectedNewSlot(null);
      fetchBookings();
    } catch (err) {
      console.error('Reschedule failed:', err);
      setRescheduleError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          'Reschedule failed. That slot may have just been reserved.'
      );
    } finally {
      setIsRescheduling(false);
    }
  };

  const isEligibleForActions = (status) =>
    ['pending', 'confirmed'].includes(status);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
          My Appointments
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Track upcoming sessions, reschedule times, or cancel bookings.
        </p>
      </div>

      {/* Feature 3: Active AI Standby Waitlists */}
      {waitlistEntries.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-zinc-950 dark:text-white" />
              Active AI Standby Waitlists ({waitlistEntries.length})
            </h3>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              AI real-time cancellation monitor
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {waitlistEntries.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-zinc-950 dark:text-white">
                    {entry.provider_name} {entry.service_name ? `• ${entry.service_name}` : ''}
                  </div>
                  <div className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {entry.preferred_date}
                    </span>
                    <span className="capitalize">({entry.time_window})</span>
                  </div>
                </div>
                <Badge
                  variant={entry.status === 'notified' ? 'default' : 'outline'}
                  className="capitalize text-[10px]"
                >
                  {entry.status === 'notified' ? 'Slot Available!' : 'Monitoring'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : bookings.length > 0 ? (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const canModify = isEligibleForActions(booking.status);
            return (
              <div
                key={booking.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-zinc-950 dark:text-white text-lg">
                      {booking.service?.name}
                    </h3>
                    <Badge status={booking.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      Provider: <strong className="text-zinc-800 dark:text-zinc-200">{booking.provider?.display_name}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      {formatDateTime(booking.start_at, user?.timezone)}
                    </span>
                    <span>
                      Fee: {formatCurrency(booking.service?.price_amount, booking.service?.currency)}
                    </span>
                    {booking.reschedule_count > 0 && (
                      <span className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        Rescheduled ({booking.reschedule_count}x)
                      </span>
                    )}
                  </div>
                </div>

                {canModify && (
                  <div className="flex items-center gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => openRescheduleModal(booking)}
                      className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCancelBooking(booking);
                        setCancelError('');
                      }}
                      className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <Calendar className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
            No Bookings Found
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            You don&apos;t have any appointments booked yet. Browse our verified providers to reserve your first slot!
          </p>
          <button
            onClick={() => router.push('/providers')}
            className="mt-5 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            Explore Providers
          </button>
        </div>
      )}

      {/* Reschedule Modal */}
      <Modal
        isOpen={!!rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        title="Reschedule Appointment"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Select a new date and open slot for{' '}
            <strong className="text-zinc-900 dark:text-zinc-100">
              {rescheduleBooking?.service?.name}
            </strong>{' '}
            with {rescheduleBooking?.provider?.display_name}.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              Select New Date
            </label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={rescheduleDate}
              onChange={(e) => {
                setRescheduleDate(e.target.value);
                setSelectedNewSlot(null);
                fetchRescheduleSlots(
                  rescheduleBooking.provider.id,
                  rescheduleBooking.service.id,
                  e.target.value
                );
              }}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-2">
              Available Slots ({user?.timezone || 'Your Timezone'})
            </label>

            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                {availableSlots.map((slot, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedNewSlot(slot)}
                    className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
                      selectedNewSlot?.start_at === slot.start_at
                        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500'
                    }`}
                  >
                    {slot.display_time || slot.display_start}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl text-center text-xs text-zinc-500 dark:text-zinc-400">
                No slots available on this date.
              </div>
            )}
          </div>

          {rescheduleError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {rescheduleError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setRescheduleBooking(null)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!selectedNewSlot || isRescheduling}
              onClick={handleConfirmReschedule}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {isRescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancelBooking}
        onClose={() => setCancelBooking(null)}
        title="Cancel Appointment"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to cancel your appointment for{' '}
            <strong className="text-zinc-900 dark:text-zinc-100">
              {cancelBooking?.service?.name}
            </strong>{' '}
            on {formatDateTime(cancelBooking?.start_at, user?.timezone)}?
          </p>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-600 dark:text-zinc-400" />
            <div>
              <p className="font-semibold">Cancellation Policy Notice</p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                Cancellations made within {cancelBooking?.provider?.cancellation_hours || 24} hours of start time may be flagged as late cancellation in accordance with provider policy.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              Reason for Cancellation (Optional)
            </label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Scheduling conflict or personal emergency"
              className="w-full p-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-white"
            />
          </div>

          {cancelError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {cancelError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setCancelBooking(null)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            >
              Nevermind
            </button>
            <button
              type="button"
              disabled={isCancelling}
              onClick={handleConfirmCancel}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
