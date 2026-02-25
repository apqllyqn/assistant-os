'use client';

import { useTaskStore } from '@/lib/stores';
import { ClipboardList, CheckCircle2, XCircle, AlertTriangle, Clock, FolderOpen } from 'lucide-react';

export function StatsBar() {
  const { stats, setFilter } = useTaskStore();

  const items = [
    { label: 'Pending', value: stats.pending, icon: ClipboardList, color: 'text-yellow-600' },
    { label: 'Overdue', value: stats.overdue, icon: Clock, color: 'text-red-600' },
    { label: 'Pushed', value: stats.pushed, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Dismissed', value: stats.dismissed, icon: XCircle, color: 'text-gray-400' },
  ];

  const unresolvedDomains = Object.entries(stats.unresolvedByDomain || {})
    .sort((a, b) => b[1] - a[1]);
  const totalUnresolved = unresolvedDomains.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Unresolved domain breakdown */}
      {totalUnresolved > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
          <FolderOpen className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <span className="text-sm text-orange-700 font-medium">
            {totalUnresolved} unresolved:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {unresolvedDomains.map(([domain, count]) => (
              <button
                key={domain}
                onClick={() => {
                  if (domain === 'unknown') {
                    setFilter('client', 'Unresolved');
                  } else {
                    setFilter('search', domain);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer"
              >
                {domain} ({count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
