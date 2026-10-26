import React from 'react';
import { Calendar, Shield } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm py-8 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center">
            <Calendar className="w-3 h-3" />
          </div>
          <span className="font-bold text-zinc-900 dark:text-white">TimeSync</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">| Zero Double-Booking Guarantee</span>
        </div>

        <div className="flex items-center space-x-6 text-[11px]">
          <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
            <Shield className="w-3.5 h-3.5" /> PostgreSQL btree_gist Exclusion Constraint
          </span>
          <span className="text-zinc-400 dark:text-zinc-600">
            © {new Date().getFullYear()} TimeSync SaaS. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
