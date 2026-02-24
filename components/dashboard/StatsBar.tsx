'use client';

import { useTaskStore } from '@/lib/stores';
import { ClipboardList, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export function StatsBar() {
  const { stats } = useTaskStore();

  const items = [
    { label: 'Pending', value: stats.pending, icon: ClipboardList, color: 'text-yellow-600' },
    { label: 'Pushed', value: stats.pushed, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Dismissed', value: stats.dismissed, icon: XCircle, color: 'text-gray-400' },
    { label: 'No Client', value: stats.unresolvedClient, icon: AlertTriangle, color: 'text-orange-500' },
  ];

  return (
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
  );
}
