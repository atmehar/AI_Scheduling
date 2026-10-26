'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  COMMON_TIMEZONES,
  getUserDefaultTimezone,
  formatCurrency,
  generateUUID,
} from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Bell,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import AIWaitlistModal from '@/components/ai/AIWaitlistModal';

export default function SlotPicker({
  provider,
  preselectedServiceId = null,
  onBookingSuccess,
}) {
  const router = useRouter();
  const { user } = useAuth();

  const services = provider?.services || [];
  const [selectedServiceId, setSelectedServiceId] = useState(
    preselectedServiceId || (services[0]?.id ? String(services[0].id) : '')
  );

  const [customerTz, setCustomerTz] = useState(
    user?.timezone || getUserDefaultTimezone()
  );

  // Selected date: default to today (formatted as YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Booking state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [intakeNotes, setIntakeNotes] = useState('');
  const [bookingSuccessData, setBookingSuccessData] = useState(null);

  // Fetch slots
  const fetchSlots = useCallback(async () => {
    if (!provider?.id || !selectedServiceId || !selectedDate) return;

    setLoadingSlots(true);
    setBookingError('');
    try {
      // Fetch 1 day range for the chosen date
      const res = await api.get(`/providers/${provider.id}/slots/`, {
        params: {
          service_id: selectedServiceId,
          from: selectedDate,
          to: selectedDate,
          tz: customerTz,
        },
      });
      setSlots(res.data.slots || []);
    } catch (err) {
      console.error('Error fetching slots:', err);
      setBookingError('Unable to load slots. Please verify provider working hours.');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [provider?.id, selectedServiceId, selectedDate, customerTz]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Selected service object
  const currentService = services.find(
    (s) => String(s.id) === String(selectedServiceId)
  );

  // Generate next 7 days for quick date tabs
  const getNextDays = () => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      days.push({ iso, weekday, dayNum });
    }
    return days;
  };

  const nextDays = getNextDays();

  // Initiate confirmation
  const handleSelectSlot = (slot) => {
    if (!user) {
      router.push(`/login?redirect=/providers/${provider.id}`);
      return;
    }
    setSelectedSlot(slot);
    setConfirmModalOpen(true);
  };

  // Submit Booking
  const handleConfirmBooking = async () => {
    if (!selectedSlot || !currentService) return;

    setIsSubmitting(true);
    setBookingError('');

    try {
      const idempotencyKey = generateUUID();

      const res = await api.post(
        '/bookings/',
        {
          provider_id: provider.id,
          service_id: currentService.id,
          start_at: selectedSlot.start_at,
          timezone: customerTz,
          intake_notes: intakeNotes,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      setConfirmModalOpen(false);
      setBookingSuccessData(res.data);
      if (onBookingSuccess) {
        onBookingSuccess(res.data);
      }
    } catch (err) {
      console.error('Booking failed:', err);

      // Handle 409 Conflict: Slot collision
      if (err.response?.status === 409) {
        setConfirmModalOpen(false);
        setConflictModalOpen(true);
        // Instant reload slots to show newly unavailable slot
        fetchSlots();
      } else {
        const errorMsg =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to book appointment. Please try again.';
        setBookingError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg shadow-zinc-950/5 p-6 md:p-8 space-y-6">
      {/* Step 1: Service selection */}
      {services.length > 0 ? (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            1. Select a Service
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => setSelectedServiceId(String(svc.id))}
                className={`p-4 rounded-xl text-left border transition-all ${
                  String(selectedServiceId) === String(svc.id)
                    ? 'border-zinc-950 dark:border-white bg-zinc-100 dark:bg-zinc-800 ring-2 ring-zinc-950/10 dark:ring-white/10'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 bg-white dark:bg-zinc-900'
                }`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-zinc-950 dark:text-white text-sm">{svc.name}</h4>
                  <span className="font-bold text-zinc-950 dark:text-white text-sm">
                    {formatCurrency(svc.price_amount, svc.currency)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    {svc.duration_minutes} mins
                  </span>
                  {svc.buffer_minutes > 0 && (
                    <span className="text-zinc-400">
                      +{svc.buffer_minutes}m buffer
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm">
          This provider does not have any active services available at this time.
        </div>
      )}

      {/* Step 2: Timezone and Date Selection */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            2. Choose Date & Timezone
          </label>

          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={customerTz}
              onChange={(e) => setCustomerTz(e.target.value)}
              className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-white"
            >
              {!COMMON_TIMEZONES.includes(customerTz) && (
                <option value={customerTz}>{customerTz}</option>
              )}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {nextDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setSelectedDate(d.iso)}
              className={`flex-shrink-0 flex flex-col items-center py-2.5 px-4 rounded-xl border text-center transition-all min-w-[76px] ${
                selectedDate === d.iso
                  ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950 shadow-md'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200'
              }`}
            >
              <span className={`text-[11px] font-medium ${selectedDate === d.iso ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-400'}`}>
                {d.weekday}
              </span>
              <span className="text-sm font-bold mt-0.5">{d.dayNum}</span>
            </button>
          ))}
          <div className="pl-2 border-l border-zinc-200 dark:border-zinc-800 flex-shrink-0">
            <input
              type="date"
              min={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20"
            />
          </div>
        </div>
      </div>

      {/* Step 3: Slots Grid */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
          3. Available Times ({customerTz})
        </label>

        {loadingSlots ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-12 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : slots.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {slots.map((slot, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSlot(slot)}
                className="py-3 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-950 hover:text-white dark:hover:bg-white dark:hover:text-zinc-950 hover:border-zinc-950 dark:hover:border-white text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition-all text-center group"
              >
                <span>{slot.display_time || slot.display_start}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setWaitlistModalOpen(true)}
              className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1.5 transition-colors font-medium"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Looking for a different slot? Join Standby Waitlist</span>
            </button>
          </div>
        </>
        ) : (
          <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-3">
            <Clock className="w-8 h-8 text-zinc-400 mx-auto" />
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No available slots for this date</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                All regular appointments on this day are booked or closed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWaitlistModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold rounded-xl hover:opacity-90 shadow-sm transition-opacity"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Join AI Standby Waitlist</span>
            </button>
          </div>
        )}
      </div>

      {/* Booking Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Appointment"
      >
        <div className="space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Provider:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{provider?.display_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Service:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currentService?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Duration:</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{currentService?.duration_minutes} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Price:</span>
              <span className="font-bold text-zinc-950 dark:text-white">
                {formatCurrency(currentService?.price_amount, currentService?.currency)}
              </span>
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Scheduled Time:</span>
              <span className="font-bold text-zinc-950 dark:text-white">
                {selectedSlot?.display_date} at {selectedSlot?.display_time} ({customerTz})
              </span>
            </div>
          </div>

          {/* Client Intake Notes Input */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
              Intake Goals & Consultation Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={intakeNotes}
              onChange={(e) => setIntakeNotes(e.target.value)}
              placeholder="What would you like to discuss in this session? (AI prepares an Executive Consultation Brief & timed agenda for your provider)..."
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all"
            />
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <p>
              • Free cancellation is allowed up to{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">{provider?.cancellation_hours || 24} hours</strong> before the start time.
            </p>
            <p>• You will receive automated 24-hour and 1-hour email reminders.</p>
          </div>

          {bookingError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmBooking}
              className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold shadow-md disabled:opacity-60 flex items-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 dark:border-zinc-900/40 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                  Securing Slot...
                </>
              ) : (
                <>
                  <span>Confirm Booking</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* 409 Conflict Dialog: Double-booking prevention */}
      <Modal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Slot No Longer Available"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-zinc-950 dark:text-white">
            Someone Just Booked This Slot!
          </h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Our PostgreSQL exclusion lock prevented double-booking. The calendar has been instantly refreshed with active remaining openings. Please pick another convenient time slot.
          </p>
          <button
            type="button"
            onClick={() => setConflictModalOpen(false)}
            className="w-full py-2.5 px-4 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold rounded-xl shadow-md transition-colors"
          >
            Choose Another Slot
          </button>
        </div>
      </Modal>

      {/* Booking Success Dialog */}
      <Modal
        isOpen={!!bookingSuccessData}
        onClose={() => {
          setBookingSuccessData(null);
          router.push('/my-bookings');
        }}
        title="Appointment Confirmed!"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-zinc-950 dark:text-white">
            Booking Confirmed (ID #{bookingSuccessData?.id})
          </h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your appointment with <span className="font-semibold text-zinc-950 dark:text-white">{provider?.display_name}</span> has been confirmed. You will receive email reminders prior to the session.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                setBookingSuccessData(null);
                router.push('/my-bookings');
              }}
              className="py-2.5 px-5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold rounded-xl shadow-md transition-colors"
            >
              View My Bookings
            </button>
          </div>
        </div>
      </Modal>

      {/* AI Standby Waitlist Dialog */}
      <AIWaitlistModal
        isOpen={waitlistModalOpen}
        onClose={() => setWaitlistModalOpen(false)}
        provider={provider}
        service={currentService}
        defaultDate={selectedDate}
      />
    </div>
  );
}
