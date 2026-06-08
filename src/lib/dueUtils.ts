import { SupabaseClient } from '@supabase/supabase-js';

// Parses a 'YYYY-MM-DD' string into a local Date object without timezone shifting
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Formats a Date object into a local 'YYYY-MM-DD' string
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Calculates subscription status based on next due date and subscription type
export function calculateStatus(
  nextDueDateStr: string,
  subscriptionType: 'Monthly' | 'Yearly'
): 'Paid' | 'Due Soon' | 'Overdue' | 'Unpaid' | 'Due Today' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = parseDateString(nextDueDateStr);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Due Today';
  }

  if (diffDays < 0) {
    return 'Overdue';
  }

  if (subscriptionType === 'Monthly') {
    return diffDays <= 7 ? 'Due Soon' : 'Paid';
  } else {
    // Yearly
    return diffDays <= 30 ? 'Due Soon' : 'Paid';
  }
}

function billingStartDate(year: number, monthIndex: number, startDay: number): Date {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(startDay, lastDayOfMonth);
  return new Date(year, monthIndex, day);
}

/**
 * Derive next due date from coverage: first uncovered billing period after payments.
 * Matches the Payment Coverage Calendar allocation model.
 */
export function calculateCoverageNextDueDate(
  startDateStr: string,
  subscriptionType: 'Monthly' | 'Yearly',
  subscriptionAmount: number,
  totalPaid: number
): string {
  const startD = parseDateString(startDateStr);
  const startDay = startD.getDate();

  if (subscriptionAmount <= 0) {
    return formatDate(startD);
  }

  const periodsCovered = Math.floor(totalPaid / subscriptionAmount);

  if (subscriptionType === 'Monthly') {
    const startYear = startD.getFullYear();
    const startMonth = startD.getMonth();
    const targetMonth = startMonth + periodsCovered;
    const targetYear = startYear + Math.floor(targetMonth / 12);
    const targetMonthIndex = ((targetMonth % 12) + 12) % 12;
    return formatDate(billingStartDate(targetYear, targetMonthIndex, startDay));
  }

  const targetYear = startD.getFullYear() + periodsCovered;
  return formatDate(billingStartDate(targetYear, startD.getMonth(), startDay));
}

// Invokes the Supabase database function to sync statuses for all members
export async function syncMemberStatuses(supabase: SupabaseClient) {
  try {
    const { error } = await supabase.rpc('sync_member_statuses');
    if (error) {
      console.error('Error executing sync_member_statuses RPC:', error);
    }
  } catch (err) {
    console.error('Failed to sync member statuses:', err);
  }
}

// Formats a number to Indian Rupees using en-IN locale
export function formatCurrency(amount: number): string {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}
