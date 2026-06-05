'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClientInstance } from '@/lib/supabase';
import {
  parseDateString,
  formatDate,
} from '@/lib/dueUtils';
import {
  Search,
  Plus,
  UserPlus,
  Phone,
  Calendar,
  DollarSign,
  MapPin,
  ChevronRight,
  Filter,
  X,
  User,
} from 'lucide-react';

interface Member {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  subscription_type: 'Monthly' | 'Yearly';
  subscription_amount: number;
  start_date: string;
  next_due_date: string;
  status: 'Paid' | 'Due Soon' | 'Overdue' | 'Unpaid';
  created_at: string;
}

function MembersPageContent() {
  const searchParams = useSearchParams();
  const supabase = createBrowserClientInstance();

  // State
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Unpaid' | 'Due Soon' | 'Overdue'>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Member Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [subType, setSubType] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [subAmount, setSubAmount] = useState('');
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load and sync data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Sync statuses on load
      await supabase.rpc('sync_member_statuses');

      // Fetch members
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
  }, []);

  // Listen for the ?add=true query param to open modal automatically
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsAddModalOpen(true);
      // Remove query param without reload
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [searchParams]);

  // Form Submission
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    if (!fullName.trim() || !phone.trim() || !subAmount || !startDate) {
      setFormError('Please fill out all required fields.');
      setIsSubmitting(false);
      return;
    }

    const amountNum = parseFloat(subAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setFormError('Subscription amount must be a positive number.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Calculate initial next due date
      const start = parseDateString(startDate);
      const nextDue = new Date(start);
      if (subType === 'Monthly') {
        nextDue.setMonth(nextDue.getMonth() + 1);
      } else {
        nextDue.setFullYear(nextDue.getFullYear() + 1);
      }
      const nextDueDateStr = formatDate(nextDue);

      // 2. Set initial status as 'Unpaid'
      const statusVal = 'Unpaid';

      // 3. Insert record into Supabase
      const { error } = await supabase
        .from('members')
        .insert({
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
          subscription_type: subType,
          subscription_amount: amountNum,
          start_date: startDate,
          next_due_date: nextDueDateStr,
          status: statusVal,
        })
        .select();

      if (error) throw error;

      // Reset Form & Close Modal
      setFullName('');
      setPhone('');
      setAddress('');
      setSubType('Monthly');
      setSubAmount('');
      setStartDate(formatDate(new Date()));
      setIsAddModalOpen(false);

      // Refresh data
      await fetchData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to add member.';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client-side Searching & Filtering
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery);

    const matchesStatus =
      statusFilter === 'All' || member.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Pagination calculations
  const totalItems = filteredMembers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Members</h2>
          <p className="text-slate-400">
            Manage your roster, subscriptions, and payment schedules.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 self-start sm:self-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition duration-150 shadow-md"
        >
          <Plus className="h-5 w-5" />
          Add Member
        </button>
      </div>

      {/* Search and Filter Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur-md">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Status Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          {(['All', 'Paid', 'Unpaid', 'Due Soon', 'Overdue'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 ${
                statusFilter === filter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Main Members View */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500 mt-3">Loading members...</p>
        </div>
      ) : paginatedMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-slate-800 bg-slate-900/10 text-center">
          <User className="h-12 w-12 text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300">No members found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            {searchQuery || statusFilter !== 'All'
              ? 'No members match your search queries and status filters.'
              : 'Get started by adding your first member to the system.'}
          </p>
          {(searchQuery || statusFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
              }}
              className="mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table view */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-800 bg-slate-900/20 shadow-md">
            <table className="w-full border-collapse text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Subscription</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Next Due Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-transparent">
                {paginatedMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-900/30 transition duration-100"
                  >
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
                      ${Number(member.subscription_amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(member.next_due_date).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          member.status === 'Paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : member.status === 'Due Soon'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : member.status === 'Unpaid'
                            ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/members/${member.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                      >
                        Details
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card view */}
          <div className="grid gap-4 grid-cols-1 md:hidden">
            {paginatedMembers.map((member) => (
              <Link
                key={member.id}
                href={`/dashboard/members/${member.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900/20 p-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-base">
                    {member.full_name}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      member.status === 'Paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : member.status === 'Due Soon'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : member.status === 'Unpaid'
                        ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    {member.phone}
                  </div>
                  <div className="text-right">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {member.subscription_type}
                    </span>
                  </div>
                  <div className="mt-1">
                    Due:{' '}
                    <span className="text-slate-300 font-medium">
                      {new Date(member.next_due_date).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </span>
                  </div>
                  <div className="text-right font-semibold text-white mt-1">
                    ${Number(member.subscription_amount).toFixed(2)}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-sm text-slate-400">
              <span>
                Showing <span className="text-slate-200">{startIndex + 1}</span> to{' '}
                <span className="text-slate-200">
                  {Math.min(startIndex + itemsPerPage, totalItems)}
                </span>{' '}
                of <span className="text-slate-200">{totalItems}</span> members
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsAddModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Add New Member</h3>
                <p className="text-xs text-slate-400">Insert member details to activate tracking.</p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Address (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Address (Optional)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Type and Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Subscription Type
                  </label>
                  <select
                    value={subType}
                    onChange={(e) => setSubType(e.target.value as 'Monthly' | 'Yearly')}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Subscription Amount ($) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={subAmount}
                      onChange={(e) => setSubAmount(e.target.value)}
                      placeholder="49.99"
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Add Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500 mt-3">Loading Members page...</p>
        </div>
      }
    >
      <MembersPageContent />
    </Suspense>
  );
}
