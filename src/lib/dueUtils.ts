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
): 'Paid' | 'Due Soon' | 'Overdue' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = parseDateString(nextDueDateStr);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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

// Calculates next due date based on payment date and current due date (Option A)
// If the member is not overdue, extend from the current due date.
// If the member is overdue, extend from the payment date.
export function calculateNextDueDate(
  currentDueDateStr: string,
  paymentDateStr: string,
  subscriptionType: 'Monthly' | 'Yearly'
): string {
  const currentDue = parseDateString(currentDueDateStr);
  const paymentDate = parseDateString(paymentDateStr);

  // Check if member is overdue at the time of payment
  // (i.e. paymentDate is after currentDue)
  const isOverdue = paymentDate.getTime() > currentDue.getTime();
  const baseDate = isOverdue ? paymentDate : currentDue;

  const nextDue = new Date(baseDate);
  if (subscriptionType === 'Monthly') {
    nextDue.setMonth(nextDue.getMonth() + 1);
  } else {
    nextDue.setFullYear(nextDue.getFullYear() + 1);
  }

  return formatDate(nextDue);
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
