-- SQL MIGRATION: ADD 'UNPAID' STATUS SUPPORT
-- Run this script in your Supabase SQL Editor to migrate your database schema.

-- 1. DROP THE OLD STATUS CHECK CONSTRAINT
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;

-- 2. ADD THE UPDATED CHECK CONSTRAINT SUPPORTING 'UNPAID'
ALTER TABLE public.members ADD CONSTRAINT members_status_check CHECK (status IN ('Paid', 'Due Soon', 'Overdue', 'Unpaid'));

-- 3. UPDATE THE BULK STATUS SYNC FUNCTION
-- Automatically sets status to 'Unpaid' if a member has no registered payments.
CREATE OR REPLACE FUNCTION public.sync_member_statuses()
RETURNS void AS $$
BEGIN
    UPDATE public.members
    SET status = CASE
        -- If no payments exist, status is always 'Unpaid'
        WHEN NOT EXISTS (
            SELECT 1 FROM public.payments 
            WHERE public.payments.member_id = public.members.id
        ) THEN 'Unpaid'
        -- Otherwise, calculate status normally based on next_due_date
        WHEN next_due_date < CURRENT_DATE THEN 'Overdue'
        WHEN subscription_type = 'Monthly' AND next_due_date - CURRENT_DATE <= 7 THEN 'Due Soon'
        WHEN subscription_type = 'Yearly' AND next_due_date - CURRENT_DATE <= 30 THEN 'Due Soon'
        ELSE 'Paid'
    END
    WHERE status IS DISTINCT FROM (
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM public.payments 
                WHERE public.payments.member_id = public.members.id
            ) THEN 'Unpaid'
            WHEN next_due_date < CURRENT_DATE THEN 'Overdue'
            WHEN subscription_type = 'Monthly' AND next_due_date - CURRENT_DATE <= 7 THEN 'Due Soon'
            WHEN subscription_type = 'Yearly' AND next_due_date - CURRENT_DATE <= 30 THEN 'Due Soon'
            ELSE 'Paid'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UPDATE STATUSES OF EXISTING MEMBERS WITH ZERO PAYMENTS
-- This updates any current records that lack payments to the 'Unpaid' status.
UPDATE public.members
SET status = 'Unpaid'
WHERE NOT EXISTS (
    SELECT 1 FROM public.payments 
    WHERE public.payments.member_id = public.members.id
);
