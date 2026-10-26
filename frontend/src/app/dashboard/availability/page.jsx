'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { WEEKDAYS, formatDateTime } from '@/lib/utils';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Shield,
  Save,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';

export default function AvailabilityPage() {
  const router = useRouter();
  const { user, isProvider, loading: authLoading } = useAuth();

  // 7-day schedule state: array of 7 items (index 0=Monday to 6=Sunday)
  const [schedule, setSchedule] = useState(
    WEEKDAYS.map((w) => ({
      weekday: w.index,
      weekday_name: w.label,
      enabled: w.index < 5, // Mon-Fri default enabled
      start_time: '09:00',
      end_time: '17:00',
    }))
  );
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  // Time off state
  const [timeOffList, setTimeOffList] = useState([]);
  const [loadingTimeOff, setLoadingTimeOff] = useState(true);
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    start_at: '',
    end_at: '',
    reason: 'Vacation / Day Off',
  });
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const [timeOffError, setTimeOffError] = useState('');

  // Load provider working hours and time-offs
  const loadData = async () => {
    try {
      // 1. Working hours
      const whRes = await api.get('/providers/me/working-hours/');
      const existingHours = whRes.data.results || whRes.data || [];

      if (existingHours.length > 0) {
        setSchedule((prev) =>
          prev.map((item) => {
            const found = existingHours.find((h) => h.weekday === item.weekday);
            if (found) {
              return {
                ...item,
                enabled: true,
                start_time: found.start_time.slice(0, 5),
                end_time: found.end_time.slice(0, 5),
                id: found.id,
              };
            }
            return { ...item, enabled: false };
          })
        );
      }

      // 2. Time-offs
      const toRes = await api.get('/providers/me/time-off/');
      setTimeOffList(toRes.data.results || toRes.data || []);
    } catch (err) {
      console.error('Error loading availability data:', err);
    } finally {
      setLoadingTimeOff(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || !isProvider)) {
      router.push('/login?redirect=/dashboard/availability');
      return;
    }
    if (user && isProvider) {
      loadData();
    }
  }, [user, isProvider, authLoading]);

  // Handle schedule toggle/change
  const handleToggleDay = (weekdayIndex) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.weekday === weekdayIndex ? { ...day, enabled: !day.enabled } : day
      )
    );
  };

  const handleTimeChange = (weekdayIndex, field, value) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.weekday === weekdayIndex ? { ...day, [field]: value } : day
      )
    );
  };

  // Save working hours batch
  const handleSaveWorkingHours = async () => {
    setSavingSchedule(true);
    setScheduleSuccess('');
    setScheduleError('');

    try {
      // Transform enabled days into payload
      const hoursPayload = schedule
        .filter((d) => d.enabled)
        .map((d) => ({
          weekday: d.weekday,
          start_time: d.start_time,
          end_time: d.end_time,
        }));

      await api.post('/providers/me/working-hours/', {
        working_hours: hoursPayload,
      });

      setScheduleSuccess('Working hours saved successfully!');
      setTimeout(() => setScheduleSuccess(''), 4000);
      loadData();
    } catch (err) {
      console.error(err);
      setScheduleError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Failed to update working hours.'
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  // Add Time Off
  const handleCreateTimeOff = async (e) => {
    e.preventDefault();
    setSavingTimeOff(true);
    setTimeOffError('');

    try {
      await api.post('/providers/me/time-off/', timeOffForm);
      setIsTimeOffModalOpen(false);
      setTimeOffForm({
        start_at: '',
        end_at: '',
        reason: 'Vacation / Day Off',
      });
      loadData();
    } catch (err) {
      console.error(err);
      setTimeOffError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Failed to record time-off.'
      );
    } finally {
      setSavingTimeOff(false);
    }
  };

  // Delete Time Off
  const handleDeleteTimeOff = async (id) => {
    try {
      await api.delete(`/providers/me/time-off/${id}/`);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to remove time-off.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-10">
      {/* Top Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
          Working Hours & Availability
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Configure your weekly recurring office hours and planned blackout dates.
        </p>
      </div>

      {/* Section 1: Weekly Working Hours */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-zinc-950 dark:text-white" />
              <span>Weekly Recurring Hours</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Timezone: <strong className="text-zinc-900 dark:text-zinc-100">{user?.timezone}</strong>
            </p>
          </div>

          <button
            type="button"
            disabled={savingSchedule}
            onClick={handleSaveWorkingHours}
            className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{savingSchedule ? 'Saving...' : 'Save Schedule'}</span>
          </button>
        </div>

        {scheduleSuccess && (
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{scheduleSuccess}</span>
          </div>
        )}

        {scheduleError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{scheduleError}</span>
          </div>
        )}

        {/* Days Table */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {schedule.map((day) => (
            <div
              key={day.weekday}
              className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                !day.enabled ? 'opacity-50 bg-zinc-50/50 dark:bg-zinc-800/30' : ''
              }`}
            >
              <div className="flex items-center gap-3 w-40">
                <input
                  type="checkbox"
                  id={`day-${day.weekday}`}
                  checked={day.enabled}
                  onChange={() => handleToggleDay(day.weekday)}
                  className="w-4 h-4 text-zinc-950 dark:text-white rounded border-zinc-300 dark:border-zinc-700 focus:ring-zinc-950 dark:focus:ring-white"
                />
                <label
                  htmlFor={`day-${day.weekday}`}
                  className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer"
                >
                  {day.weekday_name}
                </label>
              </div>

              {day.enabled ? (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 dark:text-zinc-400">From</span>
                    <input
                      type="time"
                      value={day.start_time}
                      onChange={(e) =>
                        handleTimeChange(day.weekday, 'start_time', e.target.value)
                      }
                      className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 text-xs bg-white dark:bg-zinc-800 font-medium focus:ring-1 focus:ring-zinc-950 dark:focus:ring-white"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 dark:text-zinc-400">To</span>
                    <input
                      type="time"
                      value={day.end_time}
                      onChange={(e) =>
                        handleTimeChange(day.weekday, 'end_time', e.target.value)
                      }
                      className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 text-xs bg-white dark:bg-zinc-800 font-medium focus:ring-1 focus:ring-zinc-950 dark:focus:ring-white"
                    />
                  </div>
                </div>
              ) : (
                <span className="text-xs text-zinc-400 font-medium">
                  Unavailable / Day Off
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Time-Off Blackouts */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-zinc-950 dark:text-white" />
              <span>Time-Off & Vacation Blackouts</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Slots during these blackout periods will be automatically excluded from booking.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsTimeOffModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Blackout Period</span>
          </button>
        </div>

        {timeOffList.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {timeOffList.map((to) => (
              <div
                key={to.id}
                className="py-3.5 flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">{to.reason}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {formatDateTime(to.start_at, user?.timezone)} —{' '}
                    {formatDateTime(to.end_at, user?.timezone)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteTimeOff(to.id)}
                  className="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Remove blackout"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              No time-off blackouts scheduled.
            </p>
          </div>
        )}
      </div>

      {/* Add Time Off Modal */}
      <Modal
        isOpen={isTimeOffModalOpen}
        onClose={() => setIsTimeOffModalOpen(false)}
        title="Schedule Time-Off / Blackout"
      >
        <form onSubmit={handleCreateTimeOff} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={timeOffForm.start_at}
              onChange={(e) =>
                setTimeOffForm({ ...timeOffForm, start_at: e.target.value })
              }
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={timeOffForm.end_at}
              onChange={(e) =>
                setTimeOffForm({ ...timeOffForm, end_at: e.target.value })
              }
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              Reason
            </label>
            <input
              type="text"
              required
              value={timeOffForm.reason}
              onChange={(e) =>
                setTimeOffForm({ ...timeOffForm, reason: e.target.value })
              }
              placeholder="e.g. Annual Leave, Conference, Doctor Appointment"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs"
            />
          </div>

          {timeOffError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {timeOffError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsTimeOffModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTimeOff}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {savingTimeOff ? 'Saving...' : 'Add Blackout'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
