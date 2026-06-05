-- DATABASE SCHEMA FOR MEMBER PAYMENT TRACKER
-- This file defines the tables, indexes, RLS policies, and triggers for Supabase.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------
-- 1. ADMINS TABLE
--------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY, -- Will match auth.users.id
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on admins table
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Allow admins to see and edit their own profiles
CREATE POLICY "Admins can view own profile" 
    ON public.admins 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = id);

--------------------------------------------------
-- 2. MEMBERS TABLE
--------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    subscription_type TEXT NOT NULL CHECK (subscription_type IN ('Monthly', 'Yearly')),
    subscription_amount NUMERIC(10, 2) NOT NULL CHECK (subscription_amount >= 0),
    start_date DATE NOT NULL,
    next_due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Paid', 'Due Soon', 'Overdue', 'Unpaid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on members table
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy for members
CREATE POLICY "Admins have full access to members" 
    ON public.members 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE public.admins.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE public.admins.id = auth.uid()
        )
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_members_full_name ON public.members(full_name);
CREATE INDEX IF NOT EXISTS idx_members_next_due_date ON public.members(next_due_date);

--------------------------------------------------
-- 3. PAYMENTS TABLE
--------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy for payments
CREATE POLICY "Admins have full access to payments" 
    ON public.payments 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE public.admins.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE public.admins.id = auth.uid()
        )
    );

-- Index for payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments(member_id);

--------------------------------------------------
-- 4. AUTH SYNC TRIGGER
-- Automatically adds any user created via Supabase Auth into public.admins
--------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.admins (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

--------------------------------------------------
-- 5. STATUS SYNC FUNCTION
-- Updates statuses of all members in bulk based on next_due_date and payments existence
--------------------------------------------------
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
        -- Otherwise, calculate normally based on next_due_date
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
