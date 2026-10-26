'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COMMON_TIMEZONES, getUserDefaultTimezone } from '@/lib/utils';
import {
  Calendar,
  Lock,
  Mail,
  User,
  Globe,
  Briefcase,
  UserCheck,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [role, setRole] = useState('customer'); // 'customer' | 'provider'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [timezone, setTimezone] = useState(getUserDefaultTimezone());
  const [displayName, setDisplayName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        email,
        password,
        role,
        timezone,
        first_name: firstName,
        last_name: lastName,
      };

      if (role === 'provider' && displayName) {
        payload.display_name = displayName;
      }

      const user = await register(payload);
      if (user.role === 'provider') {
        router.push('/dashboard');
      } else {
        router.push('/providers');
      }
    } catch (err) {
      console.error(err);
      let message = 'Registration failed. Please check your details.';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          message = err.response.data;
        } else if (err.response.data.email) {
          message = `Email error: ${err.response.data.email.join(', ')}`;
        } else if (err.response.data.password) {
          message = `Password error: ${err.response.data.password.join(', ')}`;
        } else if (err.response.data.detail) {
          message = err.response.data.detail;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-2xl shadow-xl shadow-zinc-950/5 border border-zinc-200 dark:border-zinc-800">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-md shadow-zinc-950/20 mb-4">
            <Calendar className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Create your TimeSync account
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Get started with conflict-free intelligent scheduling
          </p>
        </div>

        {/* Role Toggle Selector */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
              role === 'customer'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            I am a Customer
          </button>
          <button
            type="button"
            onClick={() => setRole('provider')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
              role === 'provider'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            I am a Provider
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-4 flex items-start space-x-3 text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {role === 'provider' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Business / Provider Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dr. Jane Smith or Acuity Clinic"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20 focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20 focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20 focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20 focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20 focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Your Timezone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Globe className="w-4 h-4" />
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:focus:ring-white/20 focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-zinc-100 bg-zinc-50/50 dark:bg-zinc-800/50"
              >
                {!COMMON_TIMEZONES.includes(timezone) && (
                  <option value={timezone}>{timezone} (Detected)</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 active:scale-[0.99] shadow-lg shadow-zinc-950/15 dark:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 dark:border-zinc-900/40 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                Creating account...
              </span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-zinc-950 dark:text-white underline hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
