'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClientInstance } from '@/lib/supabase';
import DatePicker from '@/components/DatePicker';
import {
  formatDate,
  calculateCoverageNextDueDate,
  formatCurrency,
  parseDateString,
} from '@/lib/dueUtils';
import { getMemberDisplayStatus } from '@/lib/statusUtils';
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
  Printer,
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

interface Contribution {
  paymentId: string;
  amountContributed: number;
  paymentDate: string;
  notes: string | null;
}

interface PeriodItem {
  year: number;
  monthIndex?: number;
  monthLabel?: string;
  fullLabel: string;
  startDate: Date;
  endDate: Date;
  requiredAmount: number;
  coveredAmount: number;
  percentage: number;
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Future' | 'Inactive';
  contributions: Contribution[];
}

// Helper functions for date parser and billing periods
function parseEnteredDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Try DD-MM-YYYY
  const dmyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  const dmyMatch = trimmed.match(dmyRegex);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000) {
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }

  // Try YYYY-MM-DD
  const ymdRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const ymdMatch = trimmed.match(ymdRegex);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000) {
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }

  return null;
}



function getBillingStartDate(year: number, monthIndex: number, startDay: number): Date {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(startDay, lastDayOfMonth);
  return new Date(year, monthIndex, day);
}

export default function MemberDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
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
  const [payDate, setPayDate] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);



  // Calendar Period Modal state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodItem | null>(null);

  // Compute Coverage Timeline client-side from start date and payments
  const coverageTimeline = useMemo(() => {
    if (!member) return null;
    
    // Sort payments chronologically (oldest first)
    const sortedPayments = [...payments].sort((a, b) => {
      const d1 = new Date(a.payment_date).getTime();
      const d2 = new Date(b.payment_date).getTime();
      if (d1 !== d2) return d1 - d2;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const startD = parseDateString(member.start_date);
    const subAmount = member.subscription_amount;
    const subType = member.subscription_type;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    if (subType === 'Monthly') {
      const startYear = startD.getFullYear();
      const startMonth = startD.getMonth(); // 0-11

      const nextDueD = parseDateString(member.next_due_date);
      const nextDueYear = nextDueD.getFullYear();
      
      let lastPaymentYear = startYear;
      if (sortedPayments.length > 0) {
        lastPaymentYear = new Date(sortedPayments[sortedPayments.length - 1].payment_date).getFullYear();
      }

      const monthsCoveredCount = subAmount > 0 ? Math.ceil(totalPaid / subAmount) : 0;
      const coveredEndD = new Date(startD);
      coveredEndD.setMonth(coveredEndD.getMonth() + Math.max(0, monthsCoveredCount - 1));
      const coveredEndYear = coveredEndD.getFullYear();

      const endYear = Math.max(today.getFullYear(), nextDueYear, lastPaymentYear, coveredEndYear);

      const yearsList: number[] = [];
      for (let y = startYear; y <= endYear; y++) {
        yearsList.push(y);
      }

      const months: PeriodItem[] = [];
      
      for (const y of yearsList) {
        for (let m = 0; m < 12; m++) {
          const isInactive = y < startYear || (y === startYear && m < startMonth);
          
          const mLabel = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
          const mFullName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m];
          
          if (isInactive) {
            months.push({
              year: y,
              monthIndex: m,
              monthLabel: mLabel,
              fullLabel: `${mFullName} ${y}`,
              startDate: new Date(y, m, 1),
              endDate: new Date(y, m + 1, 1),
              requiredAmount: 0,
              coveredAmount: 0,
              percentage: 0,
              status: 'Inactive',
              contributions: [],
            });
          } else {
            const startDate = getBillingStartDate(y, m, startD.getDate());
            const endDate = getBillingStartDate(y, m + 1, startD.getDate());
            months.push({
              year: y,
              monthIndex: m,
              monthLabel: mLabel,
              fullLabel: `${mFullName} ${y}`,
              startDate,
              endDate,
              requiredAmount: subAmount,
              coveredAmount: 0,
              percentage: 0,
              status: 'Unpaid',
              contributions: [],
            });
          }
        }
      }

      const activeMonths = months.filter(m => m.status !== 'Inactive');
      let activeIdx = 0;
      
      for (const p of sortedPayments) {
        let rem = p.amount;
        while (rem > 0 && activeIdx < activeMonths.length) {
          const m = activeMonths[activeIdx];
          const needed = m.requiredAmount - m.coveredAmount;
          if (needed <= 0) {
            activeIdx++;
            continue;
          }
          const allocated = Math.min(rem, needed);
          m.coveredAmount += allocated;
          m.contributions.push({
            paymentId: p.id,
            amountContributed: allocated,
            paymentDate: p.payment_date,
            notes: p.notes,
          });
          rem -= allocated;
          if (m.coveredAmount >= m.requiredAmount) {
            activeIdx++;
          }
        }
      }

      for (const m of months) {
        if (m.status === 'Inactive') continue;
        
        const isFuture = m.startDate > today;
        m.percentage = m.requiredAmount > 0 ? Math.round((m.coveredAmount / m.requiredAmount) * 100) : 100;
        
        if (m.coveredAmount >= m.requiredAmount) {
          m.status = 'Paid';
        } else if (m.coveredAmount > 0) {
          m.status = 'Partial';
        } else {
          m.status = isFuture ? 'Future' : 'Unpaid';
        }
      }

      const activeList = months.filter(m => m.status !== 'Inactive');
      const pastOrCurrentActive = activeList.filter(m => m.startDate <= today || m.status === 'Paid' || m.status === 'Partial');
      const totalRequiredPaid = pastOrCurrentActive.reduce((sum, m) => sum + m.requiredAmount, 0);
      const totalCovered = activeList.reduce((sum, m) => sum + m.coveredAmount, 0);
      
      const fullyCoveredCount = activeList.filter(m => m.status === 'Paid').length;
      const partialCoveredCount = activeList.filter(m => m.status === 'Partial').length;
      const unpaidCount = activeList.filter(m => m.status === 'Unpaid').length;
      const futureCount = activeList.filter(m => m.status === 'Future').length;

      const pastPresentActive = activeList.filter(m => m.startDate <= today);
      const totalPastPresentRequired = pastPresentActive.reduce((sum, m) => sum + m.requiredAmount, 0);
      const totalPastPresentCovered = pastPresentActive.reduce((sum, m) => sum + m.coveredAmount, 0);
      const remainingDuePastPresent = Math.max(0, totalPastPresentRequired - totalPastPresentCovered);

      return {
        type: 'Monthly',
        months,
        yearsList,
        summary: {
          totalPaid,
          totalRequiredPaid,
          totalCovered,
          fullyCoveredCount,
          partialCoveredCount,
          unpaidCount,
          futureCount,
          totalActive: activeList.length,
          remainingDuePastPresent,
        }
      };
    } else {
      // Yearly
      const startYear = startD.getFullYear();
      const nextDueD = parseDateString(member.next_due_date);
      const nextDueYear = nextDueD.getFullYear();

      let lastPaymentYear = startYear;
      if (sortedPayments.length > 0) {
        lastPaymentYear = new Date(sortedPayments[sortedPayments.length - 1].payment_date).getFullYear();
      }

      const yearsCoveredCount = subAmount > 0 ? Math.ceil(totalPaid / subAmount) : 0;
      const coveredEndYear = startYear + Math.max(0, yearsCoveredCount - 1);

      const endYear = Math.max(today.getFullYear(), nextDueYear, lastPaymentYear, coveredEndYear);

      const years: PeriodItem[] = [];
      for (let y = startYear; y <= endYear; y++) {
        const startDate = getBillingStartDate(y, startD.getMonth(), startD.getDate());
        const endDate = getBillingStartDate(y + 1, startD.getMonth(), startD.getDate());
        years.push({
          year: y,
          fullLabel: `${y} (${startDate.toLocaleDateString(undefined, { dateStyle: 'medium' })} - ${endDate.toLocaleDateString(undefined, { dateStyle: 'medium' })})`,
          startDate,
          endDate,
          requiredAmount: subAmount,
          coveredAmount: 0,
          percentage: 0,
          status: 'Unpaid',
          contributions: [],
        });
      }

      let activeIdx = 0;
      for (const p of sortedPayments) {
        let rem = p.amount;
        while (rem > 0 && activeIdx < years.length) {
          const y = years[activeIdx];
          const needed = y.requiredAmount - y.coveredAmount;
          if (needed <= 0) {
            activeIdx++;
            continue;
          }
          const allocated = Math.min(rem, needed);
          y.coveredAmount += allocated;
          y.contributions.push({
            paymentId: p.id,
            amountContributed: allocated,
            paymentDate: p.payment_date,
            notes: p.notes,
          });
          rem -= allocated;
          if (y.coveredAmount >= y.requiredAmount) {
            activeIdx++;
          }
        }
      }

      for (const y of years) {
        const isFuture = y.startDate > today;
        y.percentage = y.requiredAmount > 0 ? Math.round((y.coveredAmount / y.requiredAmount) * 100) : 100;

        if (y.coveredAmount >= y.requiredAmount) {
          y.status = 'Paid';
        } else if (y.coveredAmount > 0) {
          y.status = 'Partial';
        } else {
          y.status = isFuture ? 'Future' : 'Unpaid';
        }
      }

      const totalActive = years.length;
      const fullyCoveredCount = years.filter(y => y.status === 'Paid').length;
      const partialCoveredCount = years.filter(y => y.status === 'Partial').length;
      const unpaidCount = years.filter(y => y.status === 'Unpaid').length;
      const futureCount = years.filter(y => y.status === 'Future').length;

      const pastPresentActive = years.filter(y => y.startDate <= today);
      const totalPastPresentRequired = pastPresentActive.reduce((sum, y) => sum + y.requiredAmount, 0);
      const totalPastPresentCovered = pastPresentActive.reduce((sum, y) => sum + y.coveredAmount, 0);
      const remainingDuePastPresent = Math.max(0, totalPastPresentRequired - totalPastPresentCovered);

      return {
        type: 'Yearly',
        years,
        yearsList: Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i),
        summary: {
          totalPaid,
          totalRequiredPaid: pastPresentActive.reduce((sum, y) => sum + y.requiredAmount, 0),
          totalCovered: years.reduce((sum, y) => sum + y.coveredAmount, 0),
          fullyCoveredCount,
          partialCoveredCount,
          unpaidCount,
          futureCount,
          totalActive,
          remainingDuePastPresent,
        }
      };
    }
  }, [member, payments]);

  const monthlyMonths: PeriodItem[] = useMemo(() => {
    if (coverageTimeline && coverageTimeline.type === 'Monthly') {
      return (coverageTimeline as { months: PeriodItem[] }).months;
    }
    return [];
  }, [coverageTimeline]);

  const yearlyYears: PeriodItem[] = useMemo(() => {
    if (coverageTimeline && coverageTimeline.type === 'Yearly') {
      return (coverageTimeline as { years: PeriodItem[] }).years;
    }
    return [];
  }, [coverageTimeline]);

  const activePeriods: PeriodItem[] = useMemo(() => {
    if (!coverageTimeline) return [];
    return coverageTimeline.type === 'Monthly'
      ? (coverageTimeline as { months: PeriodItem[] }).months
      : (coverageTimeline as { years: PeriodItem[] }).years;
  }, [coverageTimeline]);

  const coverageNextDueDate = useMemo(() => {
    if (!member) return '';
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return calculateCoverageNextDueDate(
      member.start_date,
      member.subscription_type,
      member.subscription_amount,
      totalPaid
    );
  }, [member, payments]);

  const displayStatus = useMemo(() => {
    if (!member) return '';

    return getMemberDisplayStatus(
      {
        id: member.id,
        start_date: member.start_date,
        next_due_date: coverageNextDueDate,
        subscription_type: member.subscription_type,
        subscription_amount: member.subscription_amount,
      },
      payments.map(p => ({ amount: p.amount, payment_date: p.payment_date }))
    );
  }, [member, payments, coverageNextDueDate]);
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

  // Set initial payDate when payment modal is opened
  useEffect(() => {
    if (isPaymentModalOpen) {
      setPayDate(formatDate(new Date()));
    }
  }, [isPaymentModalOpen]);

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

    const parsedYmd = parseEnteredDate(payDate);
    if (!parsedYmd) {
      setPayError('Please enter a valid date in DD-MM-YYYY format (e.g. 06-08-2026).');
      setPaySubmitting(false);
      return;
    }

    try {
      const newTotalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + amountNum;
      const newNextDue = calculateCoverageNextDueDate(
        member.start_date,
        member.subscription_type,
        member.subscription_amount,
        newTotalPaid
      );

      // 2. Insert payment record
      const { error: payErr } = await supabase.from('payments').insert({
        member_id: member.id,
        amount: amountNum,
        payment_date: parsedYmd,
        notes: payNotes.trim() || null,
      });

      if (payErr) throw payErr;

      // 3. Update member's next due date (status will be calculated from coverage after data reload)
      const { error: memUpdateErr } = await supabase
        .from('members')
        .update({
          next_due_date: newNextDue,
        })
        .eq('id', member.id);

      if (memUpdateErr) throw memUpdateErr;

      // Reset record payment form
      setPayNotes('');
      setIsPaymentModalOpen(false);

      // Reload data to recalculate coverage-based status
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
      // Update member info (status will be calculated from coverage after data reload)
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
  }

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
    <div className="space-y-6 min-w-0">
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
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Profile Card */}
        <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md space-y-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{member.full_name}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1.5 ${
                    displayStatus === 'Paid'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : displayStatus === 'Due Today'
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      : displayStatus === 'Due Soon'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : displayStatus === 'Unpaid'
                      ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {displayStatus}
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
                    displayStatus === 'Overdue' ? 'text-red-400' : 'text-slate-200'
                  }`}>
                    {new Date(coverageNextDueDate).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Payments overview */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md space-y-6 flex flex-col justify-between min-w-0">
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
            <table className="w-full min-w-[600px] border-collapse text-left text-sm text-slate-300">
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

      {/* Coverage Summary, Legend, and Payment Coverage Calendar */}
      {coverageTimeline && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md space-y-6 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-400" /> Payment Coverage Calendar
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Visual timeline of subscription coverage calculated from membership start date.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Summary
              </button>
            </div>
          </div>

          {/* Coverage Summary Card and Status Legend */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            {/* Summary Card */}
            <div className="md:col-span-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Coverage Summary</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-slate-900/40 p-3 border border-slate-800/50">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Paid</span>
                  <p className="text-base font-bold text-emerald-400 mt-1">{formatCurrency(coverageTimeline.summary.totalPaid)}</p>
                </div>
                <div className="rounded-lg bg-slate-900/40 p-3 border border-slate-800/50">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Required (Past/Present)</span>
                  <p className="text-base font-bold text-slate-300 mt-1">{formatCurrency(coverageTimeline.summary.totalRequiredPaid)}</p>
                </div>
                <div className="rounded-lg bg-slate-900/40 p-3 border border-slate-800/50">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Remaining Due</span>
                  <p className={`text-base font-bold mt-1 ${coverageTimeline.summary.remainingDuePastPresent > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatCurrency(coverageTimeline.summary.remainingDuePastPresent)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900/40 p-3 border border-slate-800/50">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Covered Periods</span>
                  <p className="text-base font-bold text-indigo-400 mt-1">
                    {coverageTimeline.summary.fullyCoveredCount} / {coverageTimeline.summary.totalActive}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Legend */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Status Legend</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">✅</span>
                  <span className="text-slate-300 font-medium">Fully Covered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🟨</span>
                  <span className="text-slate-300 font-medium">Partially Covered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">❌</span>
                  <span className="text-slate-300 font-medium">Unpaid (Past/Due)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">⬜</span>
                  <span className="text-slate-300 font-medium">Future Period</span>
                </div>
                <div className="flex items-center gap-2 col-span-2 border-t border-slate-800/50 pt-2">
                  <span className="text-xs text-slate-500 font-bold">—</span>
                  <span className="text-slate-500 font-medium">Inactive (Before Join)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="space-y-6 pt-4 border-t border-slate-800/50">
            {coverageTimeline.type === 'Monthly' ? (
              // Monthly Timeline Grid Grouped by Year
              Object.keys(
                monthlyMonths.reduce((acc: Record<number, PeriodItem[]>, m: PeriodItem) => {
                  acc[m.year] = acc[m.year] || [];
                  acc[m.year].push(m);
                  return acc;
                }, {} as Record<number, PeriodItem[]>)
              ).map((yearStr) => {
                const year = parseInt(yearStr);
                const yearMonths = monthlyMonths.filter((m: PeriodItem) => m.year === year);
                return (
                  <div key={year} className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-300">{year}</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-12 gap-3">
                      {yearMonths.map((m: PeriodItem) => (
                        <div
                          key={m.monthIndex}
                          onClick={() => m.status !== 'Inactive' && setSelectedPeriod(m)}
                          className={`relative group flex flex-col items-center justify-center p-3 rounded-lg border transition ${
                            m.status === 'Inactive'
                              ? 'border-transparent bg-slate-950/10 cursor-not-allowed'
                              : 'border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-900/30 cursor-pointer'
                          }`}
                        >
                          <span className="text-[11px] text-slate-400 font-medium mb-1.5">{m.monthLabel}</span>
                          {m.status === 'Paid' && <span className="text-base" title="Fully Covered">✅</span>}
                          {m.status === 'Partial' && <span className="text-base" title="Partially Covered">🟨</span>}
                          {m.status === 'Unpaid' && <span className="text-base" title="Unpaid">❌</span>}
                          {m.status === 'Future' && <span className="text-base text-slate-700" title="Future Month">⬜</span>}
                          {m.status === 'Inactive' && <span className="text-xs text-slate-700 font-semibold">—</span>}

                          {/* Hover Tooltip */}
                          {m.status !== 'Inactive' && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-48 -translate-x-1/2 scale-95 rounded-lg border border-slate-800 bg-slate-950 p-3 opacity-0 shadow-2xl transition duration-150 group-hover:scale-100 group-hover:opacity-100 text-[11px] text-slate-300">
                              <div className="font-bold text-white text-xs mb-1.5 border-b border-slate-800 pb-1">{m.fullLabel}</div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Required Amount:</span>
                                  <span className="font-semibold text-slate-200">{formatCurrency(m.requiredAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Covered Amount:</span>
                                  <span className="font-semibold text-emerald-400">{formatCurrency(m.coveredAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Coverage:</span>
                                  <span className="font-semibold text-slate-200">{m.percentage}%</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-900 pt-1 mt-1">
                                  <span>Status:</span>
                                  <span className={`font-bold uppercase tracking-wider text-[10px] ${
                                    m.status === 'Paid'
                                      ? 'text-emerald-400'
                                      : m.status === 'Partial'
                                      ? 'text-amber-400'
                                      : m.status === 'Future'
                                      ? 'text-slate-500'
                                      : 'text-red-400'
                                  }`}>{m.status}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // Yearly Timeline List
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearlyYears.map((y: PeriodItem) => (
                  <div
                    key={y.year}
                    onClick={() => setSelectedPeriod(y)}
                    className="relative group flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-900/30 cursor-pointer transition"
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-slate-200">{y.year}</span>
                      <p className="text-[10px] text-slate-500">
                        {y.startDate.toLocaleDateString()} - {y.endDate.toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {y.status === 'Paid' && <span className="text-base" title="Fully Covered">✅</span>}
                      {y.status === 'Partial' && <span className="text-base" title="Partially Covered">🟨</span>}
                      {y.status === 'Unpaid' && <span className="text-base" title="Unpaid">❌</span>}
                      {y.status === 'Future' && <span className="text-base text-slate-700" title="Future Year">⬜</span>}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        y.status === 'Paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : y.status === 'Partial'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : y.status === 'Future'
                          ? 'bg-slate-800 text-slate-500'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {y.percentage}%
                      </span>
                    </div>

                    {/* Hover Tooltip for Yearly */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-48 -translate-x-1/2 scale-95 rounded-lg border border-slate-800 bg-slate-950 p-3 opacity-0 shadow-2xl transition duration-150 group-hover:scale-100 group-hover:opacity-100 text-[11px] text-slate-300">
                      <div className="font-bold text-white text-xs mb-1.5 border-b border-slate-800 pb-1">Year {y.year}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Required Amount:</span>
                          <span className="font-semibold text-slate-200">{formatCurrency(y.requiredAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Covered Amount:</span>
                          <span className="font-semibold text-emerald-400">{formatCurrency(y.coveredAmount)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-900 pt-1 mt-1">
                          <span>Status:</span>
                          <span className={`font-bold uppercase tracking-wider text-[10px] ${
                            y.status === 'Paid' ? 'text-emerald-400' : y.status === 'Partial' ? 'text-amber-400' : y.status === 'Future' ? 'text-slate-500' : 'text-red-400'
                          }`}>{y.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Payment Coverage Summary (Only visible during printing) */}
      {member && coverageTimeline && (
        <div className="hidden print:block space-y-6 bg-white text-black p-8 font-sans">
          <div className="border-b-2 border-black pb-4 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Payment Coverage Summary</h1>
            <p className="text-sm mt-1">{member.full_name} — Member ID: {member.id}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div>
              <p><strong>Phone:</strong> {member.phone}</p>
              <p><strong>Address:</strong> {member.address || '—'}</p>
              <p><strong>Start Date:</strong> {new Date(member.start_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p><strong>Subscription Plan:</strong> {member.subscription_type}</p>
              <p><strong>Subscription Cost:</strong> {formatCurrency(member.subscription_amount)}</p>
              <p><strong>Current Due Date:</strong> {new Date(coverageNextDueDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="border border-black rounded-lg p-4 mt-6">
            <h3 className="text-lg font-bold mb-2">Coverage Summary</h3>
            <table className="w-full text-left text-sm">
              <tbody>
                <tr>
                  <td className="py-1"><strong>Total Paid Amount:</strong></td>
                  <td className="py-1 text-right">{formatCurrency(coverageTimeline.summary.totalPaid)}</td>
                </tr>
                <tr>
                  <td className="py-1"><strong>Total Required Amount (Past/Present):</strong></td>
                  <td className="py-1 text-right">{formatCurrency(coverageTimeline.summary.totalRequiredPaid)}</td>
                </tr>
                <tr>
                  <td className="py-1"><strong>Remaining Balance Due:</strong></td>
                  <td className="py-1 text-right font-bold">{formatCurrency(coverageTimeline.summary.remainingDuePastPresent)}</td>
                </tr>
                <tr>
                  <td className="py-1"><strong>Fully Covered Periods:</strong></td>
                  <td className="py-1 text-right">{coverageTimeline.summary.fullyCoveredCount} out of {coverageTimeline.summary.totalActive}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold border-b border-black pb-1 mb-3">Chronological Period Breakdown</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 text-left">Period</th>
                  <th className="py-2 text-left">Billing Interval</th>
                  <th className="py-2 text-right">Required</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {activePeriods
                  .filter((item: PeriodItem) => item.status !== 'Inactive')
                  .map((item: PeriodItem, idx: number) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-2">{item.fullLabel || item.monthLabel}</td>
                      <td className="py-2 text-xs">
                        {item.startDate.toLocaleDateString()} - {item.endDate.toLocaleDateString()}
                      </td>
                      <td className="py-2 text-right">{formatCurrency(item.requiredAmount)}</td>
                      <td className="py-2 text-right">{formatCurrency(item.coveredAmount)}</td>
                      <td className="py-2 text-center font-semibold">
                        {item.status === 'Paid' && '✅ Covered'}
                        {item.status === 'Partial' && '🟨 Partial'}
                        {item.status === 'Unpaid' && '❌ Unpaid'}
                        {item.status === 'Future' && '⬜ Future'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Period Details Click Modal */}
      {selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedPeriod(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up">
            <button
              onClick={() => setSelectedPeriod(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{selectedPeriod.fullLabel || selectedPeriod.monthLabel}</h3>
                <p className="text-xs text-slate-400">
                  Billing Period: {selectedPeriod.startDate.toLocaleDateString()} - {selectedPeriod.endDate.toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Required</span>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">{formatCurrency(selectedPeriod.requiredAmount)}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Covered</span>
                  <p className="text-sm font-semibold text-emerald-400 mt-0.5">{formatCurrency(selectedPeriod.coveredAmount)}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Remaining</span>
                  <p className={`text-sm font-semibold mt-0.5 ${selectedPeriod.requiredAmount - selectedPeriod.coveredAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatCurrency(Math.max(0, selectedPeriod.requiredAmount - selectedPeriod.coveredAmount))}
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Coverage %</span>
                  <p className="text-sm font-semibold text-indigo-400 mt-0.5">{selectedPeriod.percentage}%</p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Contributing Payments</h4>
                {selectedPeriod.contributions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No payments have contributed to this period.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {selectedPeriod.contributions.map((c: Contribution, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                        <div>
                          <p className="font-semibold text-slate-300">
                            {new Date(c.paymentDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </p>
                          {c.notes && <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[180px]">{c.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-400">+{formatCurrency(c.amountContributed)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-6 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPeriod(null)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && member && (
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
                <DatePicker
                  value={payDate}
                  onChange={setPayDate}
                  required
                />
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
                  <DatePicker
                    value={editStartDate}
                    onChange={setEditStartDate}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Next Due Date *</label>
                  <DatePicker
                    value={editNextDue}
                    onChange={setEditNextDue}
                    required
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
