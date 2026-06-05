'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClientInstance } from '@/lib/supabase';
import { parseDateString, formatCurrency } from '@/lib/dueUtils';
import {
  Clock,
  Search,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

interface OverdueMember {
  id: string;
  full_name: string;
  phone: string;
  subscription_type: 'Monthly' | 'Yearly';
  subscription_amount: number;
  next_due_date: string;
}

export default function PendingPaymentsPage() {
  const supabase = createBrowserClientInstance();

  const [members, setMembers] = useState<OverdueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOverdueMembers = async () => {
    setLoading(true);
    try {
      // 1. Sync member statuses in DB first
      await supabase.rpc('sync_member_statuses');

      // 2. Fetch overdue members
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, phone, subscription_type, subscription_amount, next_due_date')
        .eq('status', 'Overdue')
        .order('next_due_date', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Error fetching overdue members:', err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchOverdueMembers();
  }, []);

  // Calculate days overdue
  const getDaysOverdue = (nextDueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = parseDateString(nextDueDateStr);
    const diffTime = today.getTime() - due.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Client-side search filtration
  const filteredMembers = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/dashboard" className="hover:text-slate-200 transition">Dashboard</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-slate-200">Pending Payments</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mt-1">Pending Payments</h2>
          <p className="text-slate-400">
            Review and collect payments from overdue subscriptions.
          </p>
        </div>
      </div>

      {/* Overview Banner */}
      {!loading && members.length > 0 && (
        <div className="flex items-center gap-3.5 rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-red-400">
          <AlertTriangle className="h-6 w-6 shrink-0 text-red-500 animate-pulse" />
          <div>
            <p className="font-semibold text-red-200">Attention Required</p>
            <p className="text-sm text-red-400/80">
              There are currently <strong className="text-red-200">{members.length} members</strong> with overdue payments. Please follow up.
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur-md">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            placeholder="Search pending members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500 mt-3">Loading overdue list...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-slate-800 bg-slate-900/10 text-center">
          <Clock className="h-12 w-12 text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300">No pending payments</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            {searchQuery
              ? 'No pending members match your search query.'
              : 'Excellent! All members have paid their dues and subscriptions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-800 bg-slate-900/20 shadow-md">
            <table className="w-full border-collapse text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Member Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Subscription</th>
                  <th className="px-6 py-4">Amount Due</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Days Overdue</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredMembers.map((member) => {
                  const days = getDaysOverdue(member.next_due_date);
                  return (
                    <tr key={member.id} className="hover:bg-slate-900/20 transition duration-100">
                      <td className="px-6 py-4 font-semibold text-white">
                        {member.full_name}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{member.phone}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300">
                          {member.subscription_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-200">
                        {formatCurrency(member.subscription_amount)}
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(member.next_due_date).toLocaleDateString(undefined, {
                          dateStyle: 'medium',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          days > 30
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {days} {days === 1 ? 'day' : 'days'} overdue
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/members/${member.id}?record=true`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                        >
                          Record Payment
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="grid gap-4 grid-cols-1 md:hidden">
            {filteredMembers.map((member) => {
              const days = getDaysOverdue(member.next_due_date);
              return (
                <Link
                  key={member.id}
                  href={`/dashboard/members/${member.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900/20 p-4 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-base">
                      {member.full_name}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {days} days overdue
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-slate-400">
                    <div className="flex justify-between">
                      <span>Plan: {member.subscription_type}</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(member.subscription_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Phone: {member.phone}</span>
                      <span>
                        Due:{' '}
                        <span className="text-slate-300 font-medium">
                          {new Date(member.next_due_date).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          })}
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
