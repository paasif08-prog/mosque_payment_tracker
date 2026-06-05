-- SQL MIGRATION: ADD 'DUE TODAY' STATUS SUPPORT
-- Run this script in your Supabase SQL Editor to update your database schema.

-- 1. DROP THE OLD STATUS CHECK CONSTRAINT
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;

-- 2. ADD THE UPDATED CHECK CONSTRAINT SUPPORTING 'DUE TODAY'
ALTER TABLE public.members ADD CONSTRAINT members_status_check CHECK (status IN ('Paid', 'Due Soon', 'Overdue', 'Unpaid', 'Due Today'));

-- 3. UPDATE THE BULK STATUS SYNC FUNCTION
-- Automatically sets status to:
--   - 'Unpaid' if no payments exist
--   - 'Due Today' if next_due_date is equal to the current date
--   - 'Overdue' if next_due_date is in the past
--   - 'Due Soon' if next_due_date is within the warning window
--   - 'Paid' otherwise
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
        -- If next due date is today
        WHEN next_due_date = CURRENT_DATE THEN 'Due Today'
        -- If next due date is in the past
        WHEN next_due_date < CURRENT_DATE THEN 'Overdue'
        -- If next due date is in the future but close
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
            WHEN next_due_date = CURRENT_DATE THEN 'Due Today'
            WHEN next_due_date < CURRENT_DATE THEN 'Overdue'
            WHEN subscription_type = 'Monthly' AND next_due_date - CURRENT_DATE <= 7 THEN 'Due Soon'
            WHEN subscription_type = 'Yearly' AND next_due_date - CURRENT_DATE <= 30 THEN 'Due Soon'
            ELSE 'Paid'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UPDATE STATUSES OF EXISTING MEMBERS
-- Force updates any current member statuses based on the new logic
SELECT public.sync_member_statuses();
