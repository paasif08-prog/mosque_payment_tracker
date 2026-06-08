-- SQL MIGRATION: DONATION MANAGEMENT MODULE
-- Run this script in your Supabase SQL Editor to update your database schema.

--------------------------------------------------
-- 1. CREATE DONATIONS TABLE
--------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    donor_name TEXT NOT NULL,
    phone TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL CHECK (category IN ('General', 'Sahar', 'Iftar')),
    notes TEXT,
    donation_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY
--------------------------------------------------
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

--------------------------------------------------
-- 3. CREATE ADMIN-ONLY POLICY FOR DONATIONS
--------------------------------------------------
DROP POLICY IF EXISTS "Admins have full access to donations" ON public.donations;

CREATE POLICY "Admins have full access to donations" 
    ON public.donations 
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

--------------------------------------------------
-- 4. CREATE INDEXES FOR PERFORMANCE
--------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_donations_member_id ON public.donations(member_id);
CREATE INDEX IF NOT EXISTS idx_donations_category ON public.donations(category);
CREATE INDEX IF NOT EXISTS idx_donations_donation_date ON public.donations(donation_date);
