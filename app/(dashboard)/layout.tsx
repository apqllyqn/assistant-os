'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useTaskStore } from '@/lib/stores';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { fetchTasks, isLoading } = useTaskStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto custom-scrollbar p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
