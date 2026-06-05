import React from 'react';
import { verifyAdmin } from '@/lib/admin';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Verify admin session on server side
  const user = await verifyAdmin();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Navigation Sidebar */}
      <Sidebar adminEmail={user.email || ''} />

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 min-w-0 transition-all duration-200">
        <div className="h-full py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
