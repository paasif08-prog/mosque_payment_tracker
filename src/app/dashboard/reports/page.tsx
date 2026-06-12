'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClientInstance } from '@/lib/supabase';
import { formatDate, formatCurrency } from '@/lib/dueUtils';
import { getDonorId } from '@/lib/donorUtils';
import {
  Download,
  Printer,
  ChevronRight,
  TrendingUp,
  Users,
  Activity,
  Heart,
  BarChart4,
  Wallet,
} from 'lucide-react';

interface ReportStats {
  membershipIncome: number;
  paidMembers: number;
  unpaidMembers: number;
  dueTodayMembers: number;
  dueSoonMembers: number;
  overdueMembers: number;

  totalDonations: number;
  generalDonations: number;
  saharDonations: number;
  iftarDonations: number;
  memberDonations: number;
  externalDonations: number;
}

interface Member {
  full_name: string;
  phone: string;
  address: string | null;
  subscription_type: string;
  subscription_amount: number;
  start_date: string;
  next_due_date: string;
  status: string;
}

interface Donation {
  id: string;
  member_id: string | null;
  donor_name: string;
  phone: string | null;
  amount: number;
  category: 'General' | 'Sahar' | 'Iftar';
  notes: string | null;
  donation_date: string;
}

interface Payment {
  amount: number;
  payment_date: string;
}

interface CategoryDonorSummary {
  key: string;
  donor_name: string;
  source: 'Member' | 'External';
  totalAmount: number;
  donationCount: number;
}

function CategoryDonationSummaryTable({
  title,
  rows,
  categoryTotal,
  footerLabel,
}: {
  title: string;
  rows: CategoryDonorSummary[];
  categoryTotal: number;
  footerLabel: string;
}) {
  return (
    <div className="space-y-2 pt-2">
      <h4 className="text-sm font-bold text-slate-200 print:text-slate-800 border-b pb-1">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No donations in this category.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-300">
          <table className="w-full text-left text-xs text-slate-350 print:text-slate-900">
            <thead className="bg-slate-900/60 print:bg-slate-100 text-xs font-semibold uppercase text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-300">
              <tr>
                <th className="p-3">Donor Name</th>
                <th className="p-3">Source</th>
                <th className="p-3 font-semibold text-emerald-400 print:text-emerald-750">Total Amount</th>
                <th className="p-3 text-right">Donation Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 print:divide-slate-300 bg-slate-900/10 print:bg-transparent">
              {rows.map((g) => (
                <tr key={g.key} className="hover:bg-slate-900/20 print:hover:bg-transparent">
                  <td className="p-3 font-semibold text-white print:text-slate-900">{g.donor_name}</td>
                  <td className="p-3">
                    <span className="text-slate-400 print:text-slate-600">{g.source}</span>
                  </td>
                  <td className="p-3 font-semibold text-emerald-400 print:text-emerald-700">
                    {formatCurrency(g.totalAmount)}
                  </td>
                  <td className="p-3 text-slate-400 print:text-slate-500 text-right">
                    {g.donationCount}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-800 print:border-slate-300 bg-slate-900/30 print:bg-slate-50">
              <tr>
                <td colSpan={2} className="p-3 font-bold text-slate-200 print:text-slate-900 uppercase tracking-wide">
                  {footerLabel}
                </td>
                <td className="p-3 font-bold text-emerald-400 print:text-emerald-700">
                  {formatCurrency(categoryTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const supabase = createBrowserClientInstance();

  const [stats, setStats] = useState<ReportStats>({
    membershipIncome: 0,
    paidMembers: 0,
    unpaidMembers: 0,
    dueTodayMembers: 0,
    dueSoonMembers: 0,
    overdueMembers: 0,

    totalDonations: 0,
    generalDonations: 0,
    saharDonations: 0,
    iftarDonations: 0,
    memberDonations: 0,
    externalDonations: 0,
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [donationRecords, setDonationRecords] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Sync member statuses
      await supabase.rpc('sync_member_statuses');

      // 2. Fetch all members
      const { data: memberData, error: memberErr } = await supabase
        .from('members')
        .select('full_name, phone, address, subscription_type, subscription_amount, start_date, next_due_date, status')
        .order('full_name', { ascending: true });

      if (memberErr) throw memberErr;
      const mems = memberData || [];
      setMembers(mems);

      // 3. Fetch all payments to calculate membership collections
      const { data: paymentData, error: paymentErr } = await supabase
        .from('payments')
        .select('amount, payment_date');

      if (paymentErr) throw paymentErr;
      setPayments(paymentData || []);

      // 4. Fetch all donations
      const { data: donationData, error: donationErr } = await supabase
        .from('donations')
        .select('id, member_id, donor_name, phone, amount, category, notes, donation_date')
        .order('donation_date', { ascending: false });

      if (donationErr) throw donationErr;

      interface DBDonation {
        id: string;
        member_id: string | null;
        donor_name: string;
        phone: string | null;
        amount: string | number;
        category: string;
        notes: string | null;
        donation_date: string;
      }

      const dons = (donationData as unknown as DBDonation[] || []).map((d) => ({
        id: d.id,
        member_id: d.member_id,
        donor_name: d.donor_name,
        phone: d.phone,
        amount: Number(d.amount),
        category: d.category as 'General' | 'Sahar' | 'Iftar',
        notes: d.notes,
        donation_date: d.donation_date,
      }));
      setDonationRecords(dons);

      // Membership Calculations
      let paidCount = 0;
      let unpaidCount = 0;
      let dueTodayCount = 0;
      let dueSoonCount = 0;
      let overdueCount = 0;

      mems.forEach((m) => {
        if (m.status === 'Paid') paidCount++;
        else if (m.status === 'Unpaid') unpaidCount++;
        else if (m.status === 'Due Today') dueTodayCount++;
        else if (m.status === 'Due Soon') dueSoonCount++;
        else if (m.status === 'Overdue') overdueCount++;
      });

      let memIncomeTotal = 0;
      paymentData?.forEach((p) => {
        memIncomeTotal += Number(p.amount);
      });

      // Donation Calculations
      let donTotal = 0;
      let donGeneral = 0;
      let donSahar = 0;
      let donIftar = 0;
      let donMember = 0;
      let donExternal = 0;

      dons.forEach((d) => {
        const amt = d.amount;
        donTotal += amt;
        if (d.category === 'General') donGeneral += amt;
        else if (d.category === 'Sahar') donSahar += amt;
        else if (d.category === 'Iftar') donIftar += amt;

        if (d.member_id) donMember += amt;
        else donExternal += amt;
      });

      setStats({
        membershipIncome: memIncomeTotal,
        paidMembers: paidCount,
        unpaidMembers: unpaidCount,
        dueTodayMembers: dueTodayCount,
        dueSoonMembers: dueSoonCount,
        overdueMembers: overdueCount,

        totalDonations: donTotal,
        generalDonations: donGeneral,
        saharDonations: donSahar,
        iftarDonations: donIftar,
        memberDonations: donMember,
        externalDonations: donExternal,
      });
    } catch (err) {
      console.error('Error loading report statistics:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Helper to format/parse month year without locale mismatches
  const getMonthYearInfo = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const monthIdx = date.getMonth();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      key: `${months[monthIdx]} ${year}`,
      sortVal: year * 12 + monthIdx,
      year,
    };
  };

  const membershipMonthlySummary = useMemo(() => {
    const map = new Map<string, { key: string; sortVal: number; total: number }>();
    payments.forEach(p => {
      const info = getMonthYearInfo(p.payment_date);
      if (info) {
        const existing = map.get(info.key);
        if (existing) {
          existing.total += Number(p.amount);
        } else {
          map.set(info.key, { key: info.key, sortVal: info.sortVal, total: Number(p.amount) });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.sortVal - a.sortVal);
  }, [payments]);

  const membershipYearlySummary = useMemo(() => {
    const map = new Map<number, { year: number; total: number }>();
    payments.forEach(p => {
      const info = getMonthYearInfo(p.payment_date);
      if (info) {
        const existing = map.get(info.year);
        if (existing) {
          existing.total += Number(p.amount);
        } else {
          map.set(info.year, { year: info.year, total: Number(p.amount) });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }, [payments]);

  const donationMonthlySummary = useMemo(() => {
    const map = new Map<string, { key: string; sortVal: number; total: number }>();
    donationRecords.forEach(d => {
      const info = getMonthYearInfo(d.donation_date);
      if (info) {
        const existing = map.get(info.key);
        if (existing) {
          existing.total += Number(d.amount);
        } else {
          map.set(info.key, { key: info.key, sortVal: info.sortVal, total: Number(d.amount) });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.sortVal - a.sortVal);
  }, [donationRecords]);

  const donationYearlySummary = useMemo(() => {
    const map = new Map<number, { year: number; total: number }>();
    donationRecords.forEach(d => {
      const info = getMonthYearInfo(d.donation_date);
      if (info) {
        const existing = map.get(info.year);
        if (existing) {
          existing.total += Number(d.amount);
        } else {
          map.set(info.year, { year: info.year, total: Number(d.amount) });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }, [donationRecords]);

  const groupedDonations = useMemo(() => {
    const map = new Map<string, {
      key: string;
      donor_name: string;
      source: 'Member' | 'External';
      category: 'General' | 'Sahar' | 'Iftar';
      totalAmount: number;
      donationCount: number;
    }>();

    donationRecords.forEach((d) => {
      const donorId = getDonorId(d.member_id, d.donor_name, d.phone);
      const key = `${donorId}:${d.category}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalAmount += d.amount;
        existing.donationCount += 1;
      } else {
        map.set(key, {
          key,
          donor_name: d.donor_name,
          source: d.member_id ? 'Member' : 'External',
          category: d.category,
          totalAmount: d.amount,
          donationCount: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [donationRecords]);

  const generalDonationsSummary = useMemo(
    () => groupedDonations.filter((g) => g.category === 'General'),
    [groupedDonations]
  );

  const saharDonationsSummary = useMemo(
    () => groupedDonations.filter((g) => g.category === 'Sahar'),
    [groupedDonations]
  );

  const iftarDonationsSummary = useMemo(
    () => groupedDonations.filter((g) => g.category === 'Iftar'),
    [groupedDonations]
  );

  // Export all members and donations to a single structured CSV
  const handleExportCSV = () => {
    const escapeCSV = (val: unknown) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows: string[] = [];

    // --- SECTION 1: MEMBERSHIP REPORT ---
    csvRows.push('=== MEMBERSHIP SECTION ===');
    const membershipHeaders = [
      'Full Name',
      'Phone',
      'Address',
      'Subscription Type',
      'Subscription Amount',
      'Start Date',
      'Next Due Date',
      'Status',
    ];
    csvRows.push(membershipHeaders.join(','));
    members.forEach((m) => {
      csvRows.push(
        [
          m.full_name,
          m.phone,
          m.address || '',
          m.subscription_type,
          formatCurrency(m.subscription_amount),
          m.start_date,
          m.next_due_date,
          m.status,
        ]
          .map(escapeCSV)
          .join(',')
      );
    });

    csvRows.push('');
    csvRows.push('MEMBERSHIP METRICS');
    csvRows.push(`Membership Income Total,${formatCurrency(stats.membershipIncome)}`);
    csvRows.push(`Paid Members,${stats.paidMembers}`);
    csvRows.push(`Unpaid Members,${stats.unpaidMembers}`);
    csvRows.push(`Due Today Members,${stats.dueTodayMembers}`);
    csvRows.push(`Due Soon Members,${stats.dueSoonMembers}`);
    csvRows.push(`Overdue Members,${stats.overdueMembers}`);

    csvRows.push('');
    csvRows.push('=== MEMBERSHIP MONTHLY SUMMARY ===');
    csvRows.push('Month,Collection');
    membershipMonthlySummary.forEach(m => {
      csvRows.push(`${escapeCSV(m.key)},${escapeCSV(formatCurrency(m.total))}`);
    });

    csvRows.push('');
    csvRows.push('=== MEMBERSHIP YEARLY SUMMARY ===');
    csvRows.push('Year,Collection');
    membershipYearlySummary.forEach(y => {
      csvRows.push(`${escapeCSV(y.year)},${escapeCSV(formatCurrency(y.total))}`);
    });

    csvRows.push('');
    csvRows.push('');

    // --- SECTION 2: DONATION REPORT ---
    csvRows.push('=== DONATION SECTION ===');
    const donationHeaders = [
      'Donor Name',
      'Source',
      'Category',
      'Total Amount',
      'Donation Count',
    ];
    csvRows.push(donationHeaders.join(','));
    groupedDonations.forEach((g) => {
      csvRows.push(
        [
          g.donor_name,
          g.source,
          g.category,
          formatCurrency(g.totalAmount),
          g.donationCount,
        ]
          .map(escapeCSV)
          .join(',')
      );
    });

    csvRows.push('');
    csvRows.push('DONATION METRICS');
    csvRows.push(`Total Donations,${formatCurrency(stats.totalDonations)}`);
    csvRows.push(`General Category Total,${formatCurrency(stats.generalDonations)}`);
    csvRows.push(`Sahar Category Total,${formatCurrency(stats.saharDonations)}`);
    csvRows.push(`Iftar Category Total,${formatCurrency(stats.iftarDonations)}`);
    csvRows.push(`Member Donations Total,${formatCurrency(stats.memberDonations)}`);
    csvRows.push(`External Donations Total,${formatCurrency(stats.externalDonations)}`);

    csvRows.push('');
    csvRows.push('=== DONATION MONTHLY SUMMARY ===');
    csvRows.push('Month,Donation Total');
    donationMonthlySummary.forEach(m => {
      csvRows.push(`${escapeCSV(m.key)},${escapeCSV(formatCurrency(m.total))}`);
    });

    csvRows.push('');
    csvRows.push('=== DONATION YEARLY SUMMARY ===');
    csvRows.push('Year,Donation Total');
    donationYearlySummary.forEach(y => {
      csvRows.push(`${escapeCSV(y.year)},${escapeCSV(formatCurrency(y.total))}`);
    });

    csvRows.push('');
    csvRows.push('');

    // --- SECTION 3: FINANCIAL SUMMARY ---
    csvRows.push('=== FINANCIAL SUMMARY ===');
    csvRows.push(`Membership Income Total,${formatCurrency(stats.membershipIncome)}`);
    csvRows.push(`Donation Income Total,${formatCurrency(stats.totalDonations)}`);
    csvRows.push(`GRAND TOTAL INCOME,${formatCurrency(stats.membershipIncome + stats.totalDonations)}`);

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_tracker_report_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open native window print dialog
  const handlePrint = () => {
    window.print();
  };

  const grandTotalIncome = stats.membershipIncome + stats.totalDonations;

  return (
    <div className="space-y-8 min-w-0">
      {/* Header (hidden on print) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/dashboard" className="hover:text-slate-200 transition">Dashboard</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-slate-200">Reports</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mt-1">Reports</h2>
          <p className="text-slate-400">
            Analyze membership collections and donations separately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={loading || (members.length === 0 && donationRecords.length === 0)}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Print-Only Title */}
      <div className="hidden print:block text-slate-900 mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">Mosque Administrative Payment & Donation Report</h1>
        <p className="text-sm text-slate-500 mt-1">Official Administrative Audit Report</p>
        <p className="text-xs text-slate-400 mt-0.5">Date generated: {new Date().toLocaleString()}</p>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500 mt-3">Compiling reports...</p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* SECTION 3: COMBINED FINANCIAL SUMMARY (Income overview) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-200 print:text-slate-900 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-indigo-400 print:hidden" /> Section 3: Combined Financial Summary
            </h3>
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
              {/* Membership Income */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center justify-between print:justify-start">
                  <span className="text-sm font-medium text-slate-400 print:text-slate-500">Membership Income</span>
                  <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 print:hidden">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-indigo-400 print:text-indigo-600">
                    {formatCurrency(stats.membershipIncome)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">Total collections from subscriptions</p>
                </div>
              </div>

              {/* Donation Income */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center justify-between print:justify-start">
                  <span className="text-sm font-medium text-slate-400 print:text-slate-500">Donation Income</span>
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 print:hidden">
                    <Heart className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-emerald-400 print:text-emerald-600">
                    {formatCurrency(stats.totalDonations)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">Total collections from donations</p>
                </div>
              </div>

              {/* Grand Total Income */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-6 shadow-lg backdrop-blur-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center justify-between print:justify-start">
                  <span className="text-sm font-semibold text-slate-200 print:text-slate-700">Grand Total Income</span>
                  <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300 print:hidden">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-white print:text-slate-950">
                    {formatCurrency(grandTotalIncome)}
                  </span>
                  <p className="text-xs text-slate-400 mt-1 print:text-slate-500">Membership + Donation combined total</p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: MEMBERSHIP REPORT */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-200 print:text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400 print:hidden" /> Section 1: Membership Report
            </h3>
            
            <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {/* Paid */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Paid Members</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.paidMembers}</p>
              </div>

              {/* Due Today */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Due Today</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">{stats.dueTodayMembers}</p>
              </div>

              {/* Due Soon */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Due Soon</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{stats.dueSoonMembers}</p>
              </div>

              {/* Overdue */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Overdue</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{stats.overdueMembers}</p>
              </div>

              {/* Unpaid */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Unpaid</p>
                <p className="text-2xl font-bold text-slate-400 mt-1">{stats.unpaidMembers}</p>
              </div>
            </div>

            {/* Membership Monthly/Yearly tables side-by-side */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 mt-6">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Membership Monthly Summary</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-300">
                  <table className="w-full text-left text-xs text-slate-350 print:text-slate-900">
                    <thead className="bg-slate-900/60 print:bg-slate-100 text-xs font-semibold uppercase text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-300">
                      <tr>
                        <th className="p-3">Month</th>
                        <th className="p-3 font-semibold text-emerald-400 print:text-emerald-700 text-right">Collection Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-300 bg-slate-900/10 print:bg-transparent">
                      {membershipMonthlySummary.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="p-3 text-slate-500 italic text-center">No monthly records found</td>
                        </tr>
                      ) : (
                        membershipMonthlySummary.map((m) => (
                          <tr key={m.key} className="hover:bg-slate-900/20">
                            <td className="p-3 font-semibold text-white print:text-slate-900">{m.key}</td>
                            <td className="p-3 font-bold text-emerald-400 print:text-emerald-700 text-right">{formatCurrency(m.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Membership Yearly Summary</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-300">
                  <table className="w-full text-left text-xs text-slate-350 print:text-slate-900">
                    <thead className="bg-slate-900/60 print:bg-slate-100 text-xs font-semibold uppercase text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-300">
                      <tr>
                        <th className="p-3">Year</th>
                        <th className="p-3 font-semibold text-emerald-400 print:text-emerald-700 text-right">Collection Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-300 bg-slate-900/10 print:bg-transparent">
                      {membershipYearlySummary.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="p-3 text-slate-500 italic text-center">No yearly records found</td>
                        </tr>
                      ) : (
                        membershipYearlySummary.map((y) => (
                          <tr key={y.year} className="hover:bg-slate-900/20">
                            <td className="p-3 font-semibold text-white print:text-slate-900">{y.year}</td>
                            <td className="p-3 font-bold text-emerald-400 print:text-emerald-700 text-right">{formatCurrency(y.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Print-only Membership List */}
            <div className="hidden print:block space-y-2 pt-2">
              <h4 className="text-sm font-bold text-slate-800 border-b pb-1">Membership Collections Details</h4>
              <table className="w-full text-left text-[10px] border">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="p-1.5">Name</th>
                    <th className="p-1.5">Phone</th>
                    <th className="p-1.5">Subscription</th>
                    <th className="p-1.5">Amount</th>
                    <th className="p-1.5">Next Due Date</th>
                    <th className="p-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-1.5 font-semibold">{m.full_name}</td>
                      <td className="p-1.5 text-slate-600">{m.phone}</td>
                      <td className="p-1.5">{m.subscription_type}</td>
                      <td className="p-1.5">{formatCurrency(m.subscription_amount)}</td>
                      <td className="p-1.5">{new Date(m.next_due_date).toLocaleDateString()}</td>
                      <td className="p-1.5 font-semibold">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: DONATION REPORT */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-200 print:text-slate-900 flex items-center gap-2">
              <Heart className="h-5 w-5 text-indigo-400 print:hidden" /> Section 2: Donation Report
            </h3>
            
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* General Category */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">General Category</p>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(stats.generalDonations)}</p>
              </div>

              {/* Sahar Category */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Sahar Category</p>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(stats.saharDonations)}</p>
              </div>

              {/* Iftar Category */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Iftar Category</p>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(stats.iftarDonations)}</p>
              </div>

              {/* Member Source */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">Member Source</p>
                <p className="text-xl font-bold text-indigo-400 mt-1">{formatCurrency(stats.memberDonations)}</p>
              </div>

              {/* External Source */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <p className="text-xs text-slate-500 uppercase font-semibold">External Source</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(stats.externalDonations)}</p>
              </div>
            </div>

            {/* Donation monthly/yearly side by side tables */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 mt-6">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Donation Monthly Summary</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-300">
                  <table className="w-full text-left text-xs text-slate-350 print:text-slate-900">
                    <thead className="bg-slate-900/60 print:bg-slate-100 text-xs font-semibold uppercase text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-300">
                      <tr>
                        <th className="p-3">Month</th>
                        <th className="p-3 font-semibold text-emerald-400 print:text-emerald-700 text-right">Donation Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-300 bg-slate-900/10 print:bg-transparent">
                      {donationMonthlySummary.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="p-3 text-slate-500 italic text-center">No monthly records found</td>
                        </tr>
                      ) : (
                        donationMonthlySummary.map((m) => (
                          <tr key={m.key} className="hover:bg-slate-900/20">
                            <td className="p-3 font-semibold text-white print:text-slate-900">{m.key}</td>
                            <td className="p-3 font-bold text-emerald-400 print:text-emerald-700 text-right">{formatCurrency(m.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Donation Yearly Summary</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-300">
                  <table className="w-full text-left text-xs text-slate-350 print:text-slate-900">
                    <thead className="bg-slate-900/60 print:bg-slate-100 text-xs font-semibold uppercase text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-300">
                      <tr>
                        <th className="p-3">Year</th>
                        <th className="p-3 font-semibold text-emerald-400 print:text-emerald-700 text-right">Donation Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-300 bg-slate-900/10 print:bg-transparent">
                      {donationYearlySummary.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="p-3 text-slate-500 italic text-center">No yearly records found</td>
                        </tr>
                      ) : (
                        donationYearlySummary.map((y) => (
                          <tr key={y.year} className="hover:bg-slate-900/20">
                            <td className="p-3 font-semibold text-white print:text-slate-900">{y.year}</td>
                            <td className="p-3 font-bold text-emerald-400 print:text-emerald-700 text-right">{formatCurrency(y.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Donation Details Grouped (Visible in Reports UI and Prints) */}
            <div className="space-y-2 pt-2">
              <h4 className="text-sm font-bold text-slate-200 print:text-slate-800 border-b pb-1">Donation Collections Details</h4>
              {groupedDonations.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No donations registered in tracker.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-300">
                  <table className="w-full text-left text-xs text-slate-350 print:text-slate-900">
                    <thead className="bg-slate-900/60 print:bg-slate-100 text-xs font-semibold uppercase text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-300">
                      <tr>
                        <th className="p-3">Donor Name</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 font-semibold text-emerald-400 print:text-emerald-750">Total Amount</th>
                        <th className="p-3 text-right">Donation Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-300 bg-slate-900/10 print:bg-transparent">
                      {groupedDonations.map((g) => (
                        <tr key={g.key} className="hover:bg-slate-900/20 print:hover:bg-transparent">
                          <td className="p-3 font-semibold text-white print:text-slate-900">{g.donor_name}</td>
                          <td className="p-3">
                            <span className="text-slate-400 print:text-slate-600">
                              {g.source}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-300 print:text-slate-800">{g.category}</span>
                          </td>
                          <td className="p-3 font-semibold text-emerald-400 print:text-emerald-700">
                            {formatCurrency(g.totalAmount)}
                          </td>
                          <td className="p-3 text-slate-400 print:text-slate-500 text-right">
                            {g.donationCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <CategoryDonationSummaryTable
              title="General Donations Summary"
              rows={generalDonationsSummary}
              categoryTotal={stats.generalDonations}
              footerLabel="General Category Total"
            />

            <CategoryDonationSummaryTable
              title="Sahar Donations Summary"
              rows={saharDonationsSummary}
              categoryTotal={stats.saharDonations}
              footerLabel="Sahar Category Total"
            />

            <CategoryDonationSummaryTable
              title="Iftar Donations Summary"
              rows={iftarDonationsSummary}
              categoryTotal={stats.iftarDonations}
              footerLabel="Iftar Category Total"
            />
          </div>

          {/* Quick Guide Card (Hidden on print) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md flex items-start gap-4 print:hidden">
            <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
              <BarChart4 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-200">How to use reports:</h4>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Click <strong className="text-slate-200">Export CSV</strong> to save all membership status metrics, collections summaries, donation logs, and the financial summary in Excel/Sheets format.
              </p>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Click <strong className="text-slate-200">Print Report</strong> to output a paper or PDF record containing clearly separated Membership Reports, Donation Reports, and Combined Financial summaries.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
