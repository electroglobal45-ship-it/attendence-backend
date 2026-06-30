-- Migration: Add phone, aadhar_card, pan_card columns to users table
-- Run this in Supabase SQL Editor

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_card TEXT,
  ADD COLUMN IF NOT EXISTS pan_card TEXT;
