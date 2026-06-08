'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClientInstance } from '@/lib/supabase';
import {
  LayoutDashboard,
  Users,
  Clock,
  BarChart3,
  LogOut,
  Menu,
  X,
  CreditCard,
  User,
  Heart,
} from 'lucide-react';

interface SidebarProps {
  adminEmail: string;
}

export default function Sidebar({ adminEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Members', href: '/dashboard/members', icon: Users },
    { name: 'Donations', href: '/dashboard/donations', icon: Heart },
    { name: 'Pending Payments', href: '/dashboard/pending', icon: Clock },
    { name: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
  ];

  const handleLogout = async () => {
    const supabase = createBrowserClientInstance();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const NavContent = () => (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-100 p-4 border-r border-slate-800">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-md leading-tight text-white">Payment Tracker</h1>
            <p className="text-xs text-indigo-400">Admin Control</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin Footer & Logout */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-300 truncate">Administrator</p>
            <p className="text-[10px] text-slate-500 truncate">{adminEmail}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors duration-150"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 text-white lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <CreditCard className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm">Payment Tracker</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Desktop Sidebar (Permanent) */}
      <aside className="fixed bottom-0 top-0 left-0 hidden w-64 lg:block">
        <NavContent />
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          {/* Menu container */}
          <div className="relative flex w-64 max-w-xs flex-col animate-slide-in">
            <NavContent />
          </div>
        </div>
      )}
    </>
  );
}
