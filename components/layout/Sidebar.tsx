'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Tasks', href: '/tasks', icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-60 flex-col border-r bg-sidebar">
      {/* Branding */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">Assistant OS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
            J
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Jenna</p>
            <p className="text-xs text-muted-foreground truncate">CHARM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
