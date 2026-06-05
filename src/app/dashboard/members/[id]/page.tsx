'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClientInstance } from '@/lib/supabase';
import {
  formatDate,
  calculateStatus,
  calculateNextDueDate,
  formatCurrency,
} from '@/lib/dueUtils';
import {
  ArrowLeft,
  Calendar,
  Phone,
  MapPin,
  IndianRupee,
  Briefcase,
  Clock,
  PlusCircle,
  Edit,
  Trash2,
  AlertTriangle,
  X,
  CreditCard,
  User,
  Activity,
  FileText,
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
  status: 'Paid' | 'Due Soon' | 'Overdue' | 'Unpaid' | 'Due Today';
  created_at: string;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export default function MemberDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const memberId = resolvedParams.id;
  
  const router = useRouter();
  const supabase = createBrowserClientInstance();

  // Loading and Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Modal Visibility States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Record Payment Form State
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(formatDate(new Date()));
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Edit Member Form State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSubType, setEditSubType] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [editAmount, setEditAmount] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editNextDue, setEditNextDue] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete State
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Fetch Member and Payment History
  const loadMemberData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Member
      const { data: memberData, error: memberErr } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();

      if (memberErr || !memberData) {
        throw new Error('Member not found.');
      }

      setMember(memberData);

      // Pre-fill Edit form
      setEditName(memberData.full_name);
      setEditPhone(memberData.phone);
      setEditAddress(memberData.address || '');
      setEditSubType(memberData.subscription_type);
      setEditAmount(String(memberData.subscription_amount));
      setEditStartDate(memberData.start_date);
      setEditNextDue(memberData.next_due_date);

      // Pre-fill Payment form
      setPayAmount(String(memberData.subscription_amount));

      // 2. Fetch Payment History
      const { data: paymentData, error: paymentErr } = await supabase
        .from('payments')
        .select('*')
        .eq('member_id', memberId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (paymentErr) throw paymentErr;
      setPayments(paymentData || []);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load details.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadMemberData();
  }, [memberId]);

  // Record Payment Submission (Option A due logic)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setPaySubmitting(true);
    setPayError(null);

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setPayError('Please enter a valid amount.');
      setPaySubmitting(false);
      return;
    }

    try {
      // 1. Calculate new next due date
      const newNextDue = calculateNextDueDate(
        member.next_due_date,
        payDate,
        member.subscription_type,
        payments.length === 0
      );

      // 2. Calculate new status based on that due date
      const newStatus = calculateStatus(newNextDue, member.subscription_type);

      // 3. Insert payment record
      const { error: payErr } = await supabase.from('payments').insert({
        member_id: member.id,
        amount: amountNum,
        payment_date: payDate,
        notes: payNotes.trim() || null,
      });

      if (payErr) throw payErr;

      // 4. Update member's status and due date
      const { error: memUpdateErr } = await supabase
        .from('members')
        .update({
          next_due_date: newNextDue,
          status: newStatus,
        })
        .eq('id', member.id);

      if (memUpdateErr) throw memUpdateErr;

      // Reset record payment form
      setPayNotes('');
      setIsPaymentModalOpen(false);

      // Reload
      await loadMemberData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to record payment.';
      setPayError(errMsg);
    } finally {
      setPaySubmitting(false);
    }
  };

  // Edit Member Submission
  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setEditSubmitting(true);
    setEditError(null);

    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setEditError('Please enter a valid amount.');
      setEditSubmitting(false);
      return;
    }

    try {
      // Recalculate status based on next due date, preserving 'Unpaid' if no payments are made
      const newStatus = payments.length === 0 ? 'Unpaid' : calculateStatus(editNextDue, editSubType);

      const { error: editErr } = await supabase
        .from('members')
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim() || null,
          subscription_type: editSubType,
          subscription_amount: amountNum,
          start_date: editStartDate,
          next_due_date: editNextDue,
          status: newStatus,
        })
        .eq('id', member.id);

      if (editErr) throw editErr;

      setIsEditModalOpen(false);
      await loadMemberData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to update member info.';
      setEditError(errMsg);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete Member Submission
  const handleDeleteMember = async () => {
    if (!member) return;
    setDeleteSubmitting(true);
    try {
      const { error: delErr } = await supabase
        .from('members')
        .delete()
        .eq('id', member.id);

      if (delErr) throw delErr;

      setIsDeleteModalOpen(false);
      router.push('/dashboard/members');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to delete member.';
      alert(errMsg);
      setDeleteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-slate-500 mt-3">Loading member details...</p>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-white">Error Loading Member</h3>
        <p className="text-sm text-red-400 mt-2">{error || 'Member not found.'}</p>
        <Link
          href="/dashboard/members"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
      </div>
    );
  }

  const lastPayment = payments.length > 0 ? payments[0] : null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/dashboard/members"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
      </div>

      {/* Main Profile Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{member.full_name}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1.5 ${
                    member.status === 'Paid'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : member.status === 'Due Today'
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
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
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit Profile
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Member
              </button>
            </div>
          </div>

          {/* Details list */}
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 text-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Phone className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Phone Number</p>
                  <p className="text-slate-200 mt-0.5">{member.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <MapPin className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Address</p>
                  <p className="text-slate-200 mt-0.5">{member.address || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <Calendar className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Start Date</p>
                  <p className="text-slate-200 mt-0.5">
                    {new Date(member.start_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Briefcase className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Subscription Plan</p>
                  <p className="text-slate-200 mt-0.5">{member.subscription_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <IndianRupee className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Subscription Cost</p>
                  <p className="text-slate-200 mt-0.5">{formatCurrency(member.subscription_amount)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <Clock className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Next Payment Due</p>
                  <p className={`font-semibold mt-0.5 ${
                    member.status === 'Overdue' ? 'text-red-400' : 'text-slate-200'
                  }`}>
                    {new Date(member.next_due_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Payments overview */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-400" /> Payment Summary
            </h3>

            <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Last Payment Date</p>
                <p className="text-sm font-medium text-slate-300 mt-1">
                  {lastPayment
                    ? new Date(lastPayment.payment_date).toLocaleDateString(undefined, { dateStyle: 'long' })
                    : 'No payments recorded'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Last Paid Amount</p>
                <p className="text-sm font-semibold text-emerald-400 mt-1">
                  {lastPayment ? formatCurrency(lastPayment.amount) : 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Total Installments Paid</p>
                <p className="text-sm font-medium text-slate-300 mt-1">{payments.length} installments</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition duration-150 shadow-md"
          >
            <PlusCircle className="h-5 w-5" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md">
        <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" /> Payment History
        </h3>

        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-slate-800 rounded-lg bg-slate-900/10 text-slate-500 text-center">
            <CreditCard className="h-10 w-10 text-slate-700 mb-3" />
            <h4 className="font-semibold text-slate-400">No payment history</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              This member has no registered payment events in the database.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full border-collapse text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Payment Date</th>
                  <th className="px-6 py-4">Amount Paid</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Date Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/20">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {new Date(p.payment_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-400">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={p.notes || ''}>
                      {p.notes || '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-slate-500">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up">
            <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Record Payment</h3>
                <p className="text-xs text-slate-400">Log a new installment for {member.full_name}</p>
              </div>
            </div>

            {payError && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{payError}</div>
            )}

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount Paid (₹) *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Payment Date *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notes (Optional)</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Cash, Bank Transfer, Ref ID, etc."
                  rows={3}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition">
                  Cancel
                </button>
                <button type="submit" disabled={paySubmitting} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50">
                  {paySubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Edit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Edit Member Information</h3>
                <p className="text-xs text-slate-400">Modify member properties below.</p>
              </div>
            </div>

            {editError && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{editError}</div>
            )}

            <form onSubmit={handleEditMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Subscription Type</label>
                  <select
                    value={editSubType}
                    onChange={(e) => setEditSubType(e.target.value as 'Monthly' | 'Yearly')}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cost (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-slate-100 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Next Due Date *</label>
                  <input
                    type="date"
                    required
                    value={editNextDue}
                    onChange={(e) => setEditNextDue(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-slate-100 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition">
                  Cancel
                </button>
                <button type="submit" disabled={editSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50">
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up">
            <button onClick={() => setIsDeleteModalOpen(false)} className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Member?</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Are you sure you want to delete <span className="font-semibold text-white"> {member.full_name} </span>? This action is permanent and will delete all payment history logs.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 mt-6 border-t border-slate-800">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 rounded-lg border border-slate-800 bg-slate-950 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteMember} disabled={deleteSubmitting} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50">
                {deleteSubmitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
