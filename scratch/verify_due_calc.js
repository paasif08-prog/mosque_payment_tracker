// Verification Script for Due Date & Status Calculations
// Run this file with Node.js to verify all test cases.

// 1. Helper function replication from src/lib/dueUtils.ts
function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Test-friendly calculateStatus that accepts a mock "today" date
function calculateStatus(nextDueDateStr, subscriptionType, today = new Date()) {
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

function calculateNextDueDate(
  currentDueDateStr,
  paymentDateStr,
  subscriptionType,
  isFirstPayment = false
) {
  const paymentDate = parseDateString(paymentDateStr);

  if (isFirstPayment) {
    const nextDue = new Date(paymentDate);
    if (subscriptionType === 'Monthly') {
      nextDue.setMonth(nextDue.getMonth() + 1);
    } else {
      nextDue.setFullYear(nextDue.getFullYear() + 1);
    }
    return formatDate(nextDue);
  }

  const currentDue = parseDateString(currentDueDateStr);

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

// 2. Test Runner
function assertEqual(actual, expected, description) {
  if (actual === expected) {
    console.log(`[PASS] ${description} (Result: ${actual})`);
  } else {
    console.error(`[FAIL] ${description}\n       Expected: "${expected}"\n       Actual:   "${actual}"`);
    process.exit(1);
  }
}

console.log("=== Running Verification Tests ===\n");

// --- Due Date Calculation Cases ---

// Case 1: First payment for newly created member
// Subscription: Monthly, Start Date: 6 Apr 2026, First payment: 6 Apr 2026
// Expected next due: 6 May 2026
assertEqual(
  calculateNextDueDate('2026-04-06', '2026-04-06', 'Monthly', true),
  '2026-05-06',
  "Monthly First Payment: 6 Apr 2026 -> 6 May 2026"
);

// Case 2: Option A on-time payment
// Current due: 1 Jul, Paid: 28 Jun (on-time)
// Expected next due: 1 Aug
assertEqual(
  calculateNextDueDate('2026-07-01', '2026-06-28', 'Monthly', false),
  '2026-08-01',
  "Option A on-time: Due 1 Jul, Paid 28 Jun -> 1 Aug"
);

// Case 3: Option A overdue payment
// Current due: 1 Jul, Paid: 15 Aug (overdue)
// Expected next due: 15 Sep
assertEqual(
  calculateNextDueDate('2026-07-01', '2026-08-15', 'Monthly', false),
  '2026-09-15',
  "Option A overdue: Due 1 Jul, Paid 15 Aug -> 15 Sep"
);

// Case 4: Yearly first payment
// Subscription: Yearly, Start Date: 6 Apr 2026, First payment: 6 Apr 2026
// Expected next due: 6 Apr 2027
assertEqual(
  calculateNextDueDate('2026-04-06', '2026-04-06', 'Yearly', true),
  '2027-04-06',
  "Yearly First Payment: 6 Apr 2026 -> 6 Apr 2027"
);

// Case 5: Yearly Option A overdue payment
// Current due: 6 Apr 2027, Paid: 10 May 2027 (overdue)
// Expected next due: 10 May 2028
assertEqual(
  calculateNextDueDate('2027-04-06', '2027-05-10', 'Yearly', false),
  '2028-05-10',
  "Yearly Option A overdue: Due 6 Apr 2027, Paid 10 May 2027 -> 10 May 2028"
);


// --- Status Check Cases (mocking CURRENT_DATE as 6 Jun 2026) ---
const mockToday = parseDateString('2026-06-06');

// Case 6: Due Today Status
// next_due_date = 6 Jun 2026 (Today)
// Expected status: Due Today
assertEqual(
  calculateStatus('2026-06-06', 'Monthly', mockToday),
  'Due Today',
  "Status is 'Due Today' if due date matches current date"
);

// Case 7: Overdue Status
// next_due_date = 5 Jun 2026 (Yesterday)
// Expected status: Overdue
assertEqual(
  calculateStatus('2026-06-05', 'Monthly', mockToday),
  'Overdue',
  "Status is 'Overdue' if due date is in the past"
);

// Case 8: Due Soon Status (Monthly)
// next_due_date = 10 Jun 2026 (4 days in the future, <= 7 days)
// Expected status: Due Soon
assertEqual(
  calculateStatus('2026-06-10', 'Monthly', mockToday),
  'Due Soon',
  "Status is 'Due Soon' for Monthly if within 7 days"
);

// Case 9: Paid Status (Monthly)
// next_due_date = 15 Jun 2026 (9 days in the future, > 7 days)
// Expected status: Paid
assertEqual(
  calculateStatus('2026-06-15', 'Monthly', mockToday),
  'Paid',
  "Status is 'Paid' for Monthly if > 7 days in the future"
);

// Case 10: Due Soon Status (Yearly)
// next_due_date = 20 Jun 2026 (14 days in the future, <= 30 days)
// Expected status: Due Soon
assertEqual(
  calculateStatus('2026-06-20', 'Yearly', mockToday),
  'Due Soon',
  "Status is 'Due Soon' for Yearly if within 30 days"
);

// Case 11: Paid Status (Yearly)
// next_due_date = 10 Jul 2026 (34 days in the future, > 30 days)
// Expected status: Paid
assertEqual(
  calculateStatus('2026-07-10', 'Yearly', mockToday),
  'Paid',
  "Status is 'Paid' for Yearly if > 30 days in the future"
);

console.log("\nAll tests completed successfully!");
