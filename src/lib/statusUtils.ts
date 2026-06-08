import { parseDateString } from './dueUtils';

export type MemberInfo = {
  id: string;
  start_date: string;
  next_due_date: string;
  subscription_type: 'Monthly' | 'Yearly';
  subscription_amount: number;
};

export type PaymentInfo = {
  amount: number;
  payment_date: string;
};

/**
 * Derive member status based on coverage calculation.
 * Returns 'Overdue' if there is any remaining due for past or present periods, otherwise 'Paid'.
 */
export function deriveMemberStatus(member: MemberInfo, payments: PaymentInfo[]): 'Paid' | 'Overdue'  | 'Unpaid' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  if (member.subscription_type === 'Monthly') {
    const startD = new Date(member.start_date);
    const monthsCoveredCount = member.subscription_amount > 0 ? Math.ceil(totalPaid / member.subscription_amount) : 0;
    const coveredEndD = new Date(startD);
    coveredEndD.setMonth(coveredEndD.getMonth() + Math.max(0, monthsCoveredCount - 1));

    const startYear = startD.getFullYear();
    const startMonth = startD.getMonth();
    const nextDueD = new Date(member.next_due_date);
    const nextDueYear = nextDueD.getFullYear();

    const endYear = Math.max(today.getFullYear(), nextDueYear, coveredEndD.getFullYear());
    const yearsList: number[] = [];
    for (let y = startYear; y <= endYear; y++) yearsList.push(y);

    const months: { startDate: Date; requiredAmount: number; coveredAmount: number }[] = [];
    for (const y of yearsList) {
      for (let m = 0; m < 12; m++) {
        const isInactive = y < startYear || (y === startYear && m < startMonth);
        if (isInactive) continue;
        const startDate = new Date(y, m, Math.min(startD.getDate(), new Date(y, m + 1, 0).getDate()));
        months.push({ startDate, requiredAmount: member.subscription_amount, coveredAmount: 0 });
      }
    }
    // Allocate payments to months
    let idx = 0;
    for (const p of payments) {
      let rem = p.amount;
      while (rem > 0 && idx < months.length) {
        const m = months[idx];
        const needed = m.requiredAmount - m.coveredAmount;
        if (needed <= 0) { idx++; continue; }
        const alloc = Math.min(rem, needed);
        m.coveredAmount += alloc;
        rem -= alloc;
        if (m.coveredAmount >= m.requiredAmount) idx++;
      }
    }
    const pastOrCurrent = months.filter(m => m.startDate <= today);
    const totalPastRequired = pastOrCurrent.reduce((s, m) => s + m.requiredAmount, 0);
    const totalPastCovered = pastOrCurrent.reduce((s, m) => s + m.coveredAmount, 0);
    const remaining = Math.max(0, totalPastRequired - totalPastCovered);
    if (remaining <= 0) {
      return 'Paid';
    }

    if (payments.length === 0) {
      return 'Unpaid';
    }

    return 'Overdue';
  } else {
    // Yearly subscription
    const startD = new Date(member.start_date);
    const yearsCoveredCount = member.subscription_amount > 0 ? Math.ceil(totalPaid / member.subscription_amount) : 0;
    const coveredEndYear = startD.getFullYear() + Math.max(0, yearsCoveredCount - 1);
    const nextDueD = new Date(member.next_due_date);
    const endYear = Math.max(today.getFullYear(), nextDueD.getFullYear(), coveredEndYear);

    const years: { startDate: Date; requiredAmount: number; coveredAmount: number }[] = [];
    for (let y = startD.getFullYear(); y <= endYear; y++) {
      const startDate = new Date(startD);
      startDate.setFullYear(y);
      years.push({ startDate, requiredAmount: member.subscription_amount, coveredAmount: 0 });
    }
    // Allocate payments
    let idx = 0;
    for (const p of payments) {
      let rem = p.amount;
      while (rem > 0 && idx < years.length) {
        const y = years[idx];
        const needed = y.requiredAmount - y.coveredAmount;
        if (needed <= 0) { idx++; continue; }
        const alloc = Math.min(rem, needed);
        y.coveredAmount += alloc;
        rem -= alloc;
        if (y.coveredAmount >= y.requiredAmount) idx++;
      }
    }
    const past = years.filter(y => y.startDate <= today);
    const totalPastRequired = past.reduce((s, y) => s + y.requiredAmount, 0);
    const totalPastCovered = past.reduce((s, y) => s + y.coveredAmount, 0);
    const remaining = Math.max(0, totalPastRequired - totalPastCovered);
    // return remaining > 0 ? 'Overdue' : 'Paid';
    if (remaining <= 0) {
      return 'Paid';
    }

    if (payments.length === 0) {
      return 'Unpaid';
    }

    return 'Overdue';
  }
}

export type MemberDisplayStatus = 'Paid' | 'Overdue' | 'Unpaid' | 'Due Today' | 'Due Soon';

/**
 * Full display status: coverage-based Paid/Overdue/Unpaid from deriveMemberStatus,
 * plus Due Today/Due Soon when coverage is current.
 */
export function getMemberDisplayStatus(
  member: MemberInfo,
  payments: PaymentInfo[]
): MemberDisplayStatus {
  const coverageStatus = deriveMemberStatus(member, payments);

  if (coverageStatus === 'Unpaid') return 'Unpaid';
  if (coverageStatus === 'Overdue') return 'Overdue';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseDateString(member.next_due_date);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due Today';

  if (member.subscription_type === 'Monthly') {
    return diffDays > 0 && diffDays <= 7 ? 'Due Soon' : 'Paid';
  }

  return diffDays > 0 && diffDays <= 30 ? 'Due Soon' : 'Paid';
}
