'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Clock,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';

export default function ServicesPage() {
  const router = useRouter();
  const { user, isProvider, loading: authLoading } = useAuth();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    duration_minutes: 30,
    buffer_minutes: 10,
    price_amount: '50.00',
    currency: 'USD',
    is_active: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete state
  const [deletingService, setDeletingService] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/providers/me/services/');
      const list = res.data.results || res.data || [];
      setServices(list);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || !isProvider)) {
      router.push('/login?redirect=/dashboard/services');
      return;
    }
    if (user && isProvider) {
      fetchServices();
    }
  }, [user, isProvider, authLoading]);

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData({
      name: '',
      duration_minutes: 30,
      buffer_minutes: 10,
      price_amount: '50.00',
      currency: 'USD',
      is_active: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (svc) => {
    setEditingService(svc);
    setFormData({
      name: svc.name,
      duration_minutes: svc.duration_minutes,
      buffer_minutes: svc.buffer_minutes,
      price_amount: svc.price_amount,
      currency: svc.currency || 'USD',
      is_active: svc.is_active,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      if (editingService) {
        await api.put(`/providers/me/services/${editingService.id}/`, formData);
      } else {
        await api.post('/providers/me/services/', formData);
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (err) {
      console.error(err);
      setFormError(
        err.response?.data?.name?.[0] ||
          err.response?.data?.detail ||
          'Failed to save service.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingService) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/providers/me/services/${deletingService.id}/`);
      setDeletingService(null);
      fetchServices();
    } catch (err) {
      console.error(err);
      alert('Failed to delete service.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Service Catalog
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Define consultation types, durations, buffers, and pricing.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Service</span>
        </button>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-40 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-zinc-950 dark:text-white text-base">{svc.name}</h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      svc.is_active
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {svc.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="text-2xl font-extrabold text-zinc-950 dark:text-white my-2">
                  {formatCurrency(svc.price_amount, svc.currency)}
                </div>

                <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 mb-4">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {svc.duration_minutes} minutes
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buffer Time:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {svc.buffer_minutes} minutes
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Slot Block:</span>
                    <span className="font-semibold text-zinc-950 dark:text-white">
                      {svc.duration_minutes + svc.buffer_minutes} minutes
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(svc)}
                  className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Edit service"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingService(svc)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Delete service"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
          <Layers className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">No Services Added</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            You need at least one active service so customers can book appointments with you.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            Create Your First Service
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingService ? 'Edit Service' : 'Add New Service'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              Service Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. 1-on-1 Consultation"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                Duration (mins)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                required
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration_minutes: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                Buffer Time (mins)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                required
                value={formData.buffer_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    buffer_minutes: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                Price Amount
              </label>
              <input
                type="text"
                required
                value={formData.price_amount}
                onChange={(e) =>
                  setFormData({ ...formData, price_amount: e.target.value })
                }
                placeholder="50.00"
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-950 focus:ring-zinc-950 dark:focus:ring-white"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Active for customer bookings
            </label>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {formLoading ? 'Saving...' : 'Save Service'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingService}
        onClose={() => setDeletingService(null)}
        title="Delete Service"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete{' '}
            <strong className="text-zinc-950 dark:text-white">{deletingService?.name}</strong>? Existing bookings will remain unaffected, but new bookings cannot be placed.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDeletingService(null)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteLoading}
              onClick={handleDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
