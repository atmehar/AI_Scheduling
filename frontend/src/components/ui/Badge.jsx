import React from 'react';

export default function Badge({ status, text, className = '' }) {
  const normalized = (status || text || '').toLowerCase();

  const styles = {
    confirmed:
      'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white ring-zinc-500/20',
    completed:
      'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 ring-zinc-400/20',
    pending:
      'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700/50 ring-amber-500/20',
    cancelled:
      'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 ring-zinc-400/10',
    late_cancelled:
      'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 ring-zinc-400/10',
    no_show:
      'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 ring-zinc-400/10',
    provider:
      'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-800 dark:border-zinc-300 ring-zinc-500/20',
    customer:
      'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 ring-zinc-500/20',
  };

  const currentStyle =
    styles[normalized] ||
    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 ring-zinc-500/20';

  const formatText = (str) => {
    if (!str) return '';
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ring-1 shrink-0 whitespace-nowrap ${currentStyle} ${className}`}
    >
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-70"></span>
      {text || formatText(status)}
    </span>
  );
}
