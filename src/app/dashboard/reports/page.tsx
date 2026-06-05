'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClientInstance } from '@/lib/supabase';
import { formatDate, formatCurrency } from '@/lib/dueUtils';
import {
  Download,
  Printer,
  ChevronRight,
  TrendingUp,
  Users,
  CheckCircle,
  AlertTriangle,
  IndianRupee,
  Calendar,
  Activity,
} from 'lucide-react';

interface ReportStats {
  totalCollection: number;
  monthlyCollection: number;
  yearlyCollection: number;
  totalPaid: number;
  totalUnpaid: number;
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

export default function ReportsPage() {
  const supabase = createBrowserClientInstance();

  const [stats, setStats] = useState<ReportStats>({
    totalCollection: 0,
    monthlyCollection: 0,
    yearlyCollection: 0,
    totalPaid: 0,
    totalUnpaid: 0,
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // 1. Sync member statuses
      await supabase.rpc('sync_member_statuses');

      // 2. Fetch all members for CSV export & counts
      const { data: memberData, error: memberErr } = await supabase
        .from('members')
        .select('full_name, phone, address, subscription_type, subscription_amount, start_date, next_due_date, status')
        .order('full_name', { ascending: true });

      if (memberErr) throw memberErr;
      setMembers(memberData || []);

      // Calculate Paid & Unpaid counts
      let paid = 0;
      let unpaid = 0;
      memberData?.forEach((m) => {
        if (m.status === 'Paid') {
          paid++;
        } else {
          unpaid++;
        }
      });

      // 3. Fetch all payments to calculate collections
      const { data: paymentData, error: paymentErr } = await supabase
        .from('payments')
        .select('amount, payment_date');

      if (paymentErr) throw paymentErr;

      let totalColl = 0;
      let monthlyColl = 0;
      let yearlyColl = 0;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11

      paymentData?.forEach((p) => {
        const amt = Number(p.amount);
        totalColl += amt;

        const payDate = new Date(p.payment_date);
        if (payDate.getFullYear() === currentYear) {
          yearlyColl += amt;
          if (payDate.getMonth() === currentMonth) {
            monthlyColl += amt;
          }
        }
      });

      setStats({
        totalCollection: totalColl,
        monthlyCollection: monthlyColl,
        yearlyCollection: yearlyColl,
        totalPaid: paid,
        totalUnpaid: unpaid,
      });
    } catch (err) {
      console.error('Error loading report statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchReportData();
  }, []);

  // Export all members data to a clean CSV
  const handleExportCSV = () => {
    if (members.length === 0) return;

    const headers = [
      'Full Name',
      'Phone',
      'Address',
      'Subscription Type',
      'Subscription Amount',
      'Start Date',
      'Next Due Date',
      'Status',
    ];

    const escapeCSV = (val: unknown) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...members.map((m) =>
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
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `member_payment_report_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open native window print dialog
  const handlePrint = () => {
    window.print();
  };

  const totalMembers = stats.totalPaid + stats.totalUnpaid;

  return (
    <div className="space-y-6">
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
            Export data and examine financial audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={loading || members.length === 0}
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
        <h1 className="text-2xl font-bold">Member Payment Tracker</h1>
        <p className="text-sm text-slate-500 mt-1">Official Administrative Payment & Roster Audit Report</p>
        <p className="text-xs text-slate-400 mt-0.5">Date generated: {new Date().toLocaleString()}</p>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500 mt-3">Compiling reports...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Collection summaries */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 print:text-slate-900">Collection Metrics</h3>
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
              {/* Total Collection */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center justify-between print:justify-start print:gap-2">
                  <span className="text-sm font-medium text-slate-400 print:text-slate-500">Total Collection</span>
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 print:hidden">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-white print:text-emerald-600">
                    {formatCurrency(stats.totalCollection)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1 print:text-slate-400">Total historical recorded collections</p>
                </div>
              </div>

              {/* Monthly Collection */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center justify-between print:justify-start print:gap-2">
                  <span className="text-sm font-medium text-slate-400 print:text-slate-500">Monthly Collection</span>
                  <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 print:hidden">
                    <Calendar className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-white print:text-indigo-600">
                    {formatCurrency(stats.monthlyCollection)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1 print:text-slate-400">
                    Current month: {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Yearly Collection */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center justify-between print:justify-start print:gap-2">
                  <span className="text-sm font-medium text-slate-400 print:text-slate-500">Yearly Collection</span>
                  <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400 print:hidden">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-white print:text-purple-600">
                    {formatCurrency(stats.yearlyCollection)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1 print:text-slate-400">Current calendar year: {new Date().getFullYear()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Membership roster stats */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 print:text-slate-900">Membership Metrics</h3>
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
              {/* Total Members */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-800 p-2 text-slate-300 print:hidden">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Members</p>
                    <p className="text-xl font-bold text-white print:text-slate-950 mt-0.5">{totalMembers}</p>
                  </div>
                </div>
              </div>

              {/* Paid Members */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 print:hidden">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Paid Members</p>
                    <p className="text-xl font-bold text-emerald-400 print:text-emerald-600 mt-0.5">
                      {stats.totalPaid}{' '}
                      <span className="text-xs font-normal text-slate-400 print:text-slate-400 ml-1">
                        ({totalMembers > 0 ? Math.round((stats.totalPaid / totalMembers) * 100) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Unpaid Members */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md print:bg-white print:border print:text-slate-900">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 print:hidden">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Unpaid Members</p>
                    <p className="text-xl font-bold text-amber-400 print:text-amber-600 mt-0.5">
                      {stats.totalUnpaid}{' '}
                      <span className="text-xs font-normal text-slate-400 print:text-slate-400 ml-1">
                        ({totalMembers > 0 ? Math.round((stats.totalUnpaid / totalMembers) * 100) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Member Roster List (Shown on Print) */}
          <div className="hidden print:block space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Full Membership Audit Roster</h3>
            <table className="w-full text-left text-xs border">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="p-2">Name</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Subscription</th>
                  <th className="p-2">Cost</th>
                  <th className="p-2">Next Due Date</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 font-semibold">{m.full_name}</td>
                    <td className="p-2 text-slate-600">{m.phone}</td>
                    <td className="p-2">{m.subscription_type}</td>
                    <td className="p-2">{formatCurrency(m.subscription_amount)}</td>
                    <td className="p-2">{new Date(m.next_due_date).toLocaleDateString()}</td>
                    <td className="p-2 font-semibold">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Guide Card (Hidden on print) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md flex items-start gap-4 print:hidden">
            <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-200">How to use reports:</h4>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Click <strong className="text-slate-200">Export CSV</strong> to save all members, their subscriptions, phone numbers, and statuses into a spreadsheet format (compatible with Excel, Sheets, and DB parsers).
              </p>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Click <strong className="text-slate-200">Print Report</strong> to open the system print dialog. Page layouts will automatically hide the dashboard sidebar and header menus, generating a clean paper/PDF receipt invoice audit log.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
