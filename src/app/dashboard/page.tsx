import React from 'react';
import Link from 'next/link';
import { createServerClientInstance } from '@/lib/supabase-server';
import { calculateCoverageNextDueDate, formatCurrency, parseDateString } from '@/lib/dueUtils';
import { getMemberDisplayStatus } from '@/lib/statusUtils';
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  Plus,
  CreditCard,
  FileText,
  TrendingUp,
  Heart,
} from 'lucide-react';

export const revalidate = 0; // Disable caching for dashboard

export default async function DashboardPage() {
  const supabase = await createServerClientInstance();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const [
    { data: memberRows },
    { data: paymentRows },
    { data: donationData },
  ] = await Promise.all([
    supabase.from('members').select('id, start_date, next_due_date, subscription_type, subscription_amount'),
    supabase.from('payments').select('member_id, amount, payment_date'),
    supabase.from('donations').select('amount, category, member_id'),
  ]);

  const paymentsByMember = new Map<string, { amount: number; payment_date: string }[]>();
  paymentRows?.forEach((p) => {
    const list = paymentsByMember.get(p.member_id) || [];
    list.push({ amount: p.amount, payment_date: p.payment_date });
    paymentsByMember.set(p.member_id, list);
  });

  let paid = 0;
  let unpaid = 0;
  let overdue = 0;
  let dueToday = 0;
  let dueThisWeek = 0;

  memberRows?.forEach((m) => {
    const memberPayments = paymentsByMember.get(m.id) || [];
    const totalPaid = memberPayments.reduce((sum, p) => sum + p.amount, 0);
    const nextDueDate = calculateCoverageNextDueDate(
      m.start_date,
      m.subscription_type,
      m.subscription_amount,
      totalPaid
    );
    const status = getMemberDisplayStatus(
      {
        id: m.id,
        start_date: m.start_date,
        next_due_date: nextDueDate,
        subscription_type: m.subscription_type,
        subscription_amount: m.subscription_amount,
      },
      memberPayments
    );

    if (status === 'Paid') paid++;
    else if (status === 'Unpaid') unpaid++;
    else if (status === 'Overdue') overdue++;
    else if (status === 'Due Today') dueToday++;

    const due = parseDateString(nextDueDate);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7) dueThisWeek++;
  });

  const total = memberRows?.length || 0;

  // Donation aggregations
  let totalDonations = 0;
  let generalDonations = 0;
  let saharDonations = 0;
  let iftarDonations = 0;
  let memberDonations = 0;
  let externalDonations = 0;

  donationData?.forEach((d) => {
    const amt = Number(d.amount);
    totalDonations += amt;
    if (d.category === 'General') generalDonations += amt;
    else if (d.category === 'Sahar') saharDonations += amt;
    else if (d.category === 'Iftar') iftarDonations += amt;

    if (d.member_id) memberDonations += amt;
    else externalDonations += amt;
  });

  // 3. Fetch Recent Payments (Last 5 records)
  const { data: recentPayments } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      payment_date,
      members (
        id,
        full_name
      )
    `)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  const paymentsList = (recentPayments || []) as unknown as {
    id: string;
    amount: number;
    payment_date: string;
    members: {
      id: string;
      full_name: string;
    } | null;
  }[];

  return (
    <div className="space-y-8 min-w-0">
      {/* Header section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
          <p className="text-slate-400">
            Overview of membership statuses and payments.
          </p>
        </div>
        <div className="text-sm text-slate-400 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl min-w-0 shrink">
          Today is <span className="font-semibold text-slate-200">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Clickable Pending Payments Alert Banner */}
      {overdue > 0 ? (
        <Link
          href="/dashboard/pending"
          className="flex items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 sm:p-5 hover:bg-red-500/15 transition duration-150 group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-red-200 text-sm sm:text-base">
                {overdue} {overdue === 1 ? 'Member Has' : 'Members Have'} Pending Payments
              </p>
              <p className="text-xs sm:text-sm text-red-400/80 mt-0.5">
                Review overdue accounts and follow up on pending balances.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-red-400 font-medium text-sm group-hover:text-red-300 transition-colors">
            Resolve
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-emerald-400">
          <CheckCircle className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-200">All payments up to date</p>
            <p className="text-sm text-emerald-400/80">No members are currently overdue.</p>
          </div>
        </div>
      )}

      {/* 6 Grid Stats Widgets */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Members */}
        <Link
          href="/dashboard/members"
          className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md hover:scale-[1.02] hover:border-slate-700/50 hover:shadow-lg hover:shadow-slate-950/50 transition duration-200 group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Total Members</span>
            <div className="rounded-lg bg-slate-800 p-2 text-slate-300 group-hover:bg-slate-700 transition-colors">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{total}</span>
            <p className="text-xs text-slate-500 mt-1">Registered members in tracker</p>
          </div>
        </Link>

        {/* Paid Members */}
        <Link
          href="/dashboard/members?status=paid"
          className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md hover:scale-[1.02] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition duration-200 group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Paid Members</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition duration-200">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-emerald-400">{paid}</span>
            <p className="text-xs text-slate-500 mt-1">
              {total > 0 ? Math.round((paid / total) * 100) : 0}% of total membership
            </p>
          </div>
        </Link>

        {/* Unpaid Members */}
        <Link
          href="/dashboard/members?status=unpaid"
          className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md hover:scale-[1.02] hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition duration-200 group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Unpaid Members</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition duration-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-amber-400">{unpaid}</span>
            <p className="text-xs text-slate-500 mt-1">Unpaid, due soon or overdue members</p>
          </div>
        </Link>

        {/* Overdue Members */}
        <Link
          href="/dashboard/members?status=overdue"
          className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md hover:scale-[1.02] hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/5 transition duration-200 group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Overdue Members</span>
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400 group-hover:bg-red-500 group-hover:text-white transition duration-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-red-400">{overdue}</span>
            <p className="text-xs text-slate-500 mt-1">Requires immediate payment record</p>
          </div>
        </Link>

        {/* Due Today */}
        <Link
          href="/dashboard/members?status=due-today"
          className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md hover:scale-[1.02] hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 transition duration-200 group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Due Today</span>
            <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition duration-200">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-orange-400">{dueToday}</span>
            <p className="text-xs text-slate-500 mt-1">Subscriptions ending today</p>
          </div>
        </Link>

        {/* Due This Week */}
        <Link
          href="/dashboard/members?filter=due-week"
          className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md hover:scale-[1.02] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition duration-200 group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Due This Week</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition duration-200">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-blue-400">{dueThisWeek}</span>
            <p className="text-xs text-slate-500 mt-1">Next 7 days due timeline</p>
          </div>
        </Link>
      </div>

      {/* Donation Summary Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200">Donation Summary</h3>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Donations */}
          <Link
            href="/dashboard/donations"
            className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md hover:scale-[1.02] hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition duration-200 group block cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Total Donations</span>
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition duration-200">
                <Heart className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-white">{formatCurrency(totalDonations)}</span>
              <p className="text-xs text-slate-500 mt-1">Total combined donations</p>
            </div>
          </Link>

          {/* Donations by Category */}
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">By Category</span>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1.5 mt-2">
              <Link
                href="/dashboard/donations?category=General"
                className="flex justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-850 hover:text-indigo-400 transition"
              >
                <span className="text-slate-400">General:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(generalDonations)}</span>
              </Link>
              <Link
                href="/dashboard/donations?category=Sahar"
                className="flex justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-850 hover:text-indigo-400 transition"
              >
                <span className="text-slate-400">Sahar:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(saharDonations)}</span>
              </Link>
              <Link
                href="/dashboard/donations?category=Iftar"
                className="flex justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-850 hover:text-indigo-400 transition"
              >
                <span className="text-slate-400">Iftar:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(iftarDonations)}</span>
              </Link>
            </div>
          </div>

          {/* Donations by Source */}
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">By Source</span>
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1.5 mt-2">
              <Link
                href="/dashboard/donations?source=member"
                className="flex justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-850 hover:text-indigo-400 transition"
              >
                <span className="text-slate-400">Member Donations:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(memberDonations)}</span>
              </Link>
              <Link
                href="/dashboard/donations?source=external"
                className="flex justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-850 hover:text-indigo-400 transition"
              >
                <span className="text-slate-400">External Donors:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(externalDonations)}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200">Quick Actions</h3>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
          <Link
            href="/dashboard/members?add=true"
            className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/20 p-5 hover:bg-slate-900/60 hover:border-indigo-500/50 transition duration-150 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition duration-200">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-slate-300">Add Member</span>
          </Link>

          <Link
            href="/dashboard/members"
            className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/20 p-5 hover:bg-slate-900/60 hover:border-emerald-500/50 transition duration-150 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition duration-200">
              <CreditCard className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-slate-300">Record Payment</span>
          </Link>

          <Link
            href="/dashboard/members"
            className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/20 p-5 hover:bg-slate-900/60 hover:border-blue-500/50 transition duration-150 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition duration-200">
              <Users className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-slate-300">View Members</span>
          </Link>

          <Link
            href="/dashboard/donations?add=true"
            className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/20 p-5 hover:bg-slate-900/60 hover:border-rose-500/50 transition duration-150 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition duration-200">
              <Heart className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-slate-300">Log Donation</span>
          </Link>

          <Link
            href="/dashboard/reports"
            className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/20 p-5 hover:bg-slate-900/60 hover:border-purple-500/50 transition duration-150 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition duration-200">
              <FileText className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-slate-300">View Reports</span>
          </Link>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Recent Payments Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-200">Recent Payments</h3>
            <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Tracked
            </span>
          </div>

          {!recentPayments || recentPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-800 rounded-lg bg-slate-900/10 text-slate-500">
              <CreditCard className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm">No payment records found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {paymentsList.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="flex flex-col min-w-0">
                    <Link
                      href={`/dashboard/members/${payment.members?.id}`}
                      className="font-medium text-slate-200 text-sm hover:underline hover:text-indigo-400 truncate"
                    >
                      {payment.members?.full_name || 'Unknown Member'}
                    </Link>
                    <span className="text-xs text-slate-500 mt-0.5">
                      Paid on {new Date(payment.payment_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <div className="font-semibold text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    +{formatCurrency(payment.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Information Quick Guide Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 shadow-md backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Member Billing Guidelines</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Use the Member Payment Tracker to catalog payments and update states. The tracking status adjusts automatically relative to members&apos; billing schedules.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span><strong className="text-slate-300">Paid:</strong> Subscription is currently active and within schedule.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span><strong className="text-slate-300">Due Soon:</strong> Monthly due within 7 days; Yearly within 30 days.</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span><strong className="text-slate-300">Overdue:</strong> Due date has passed. Immediate collection recommended.</span>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-800 mt-6 flex justify-between items-center text-xs text-slate-500">
            <span>Security: Row Level Encryption Active</span>
            <span>Single Admin Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
