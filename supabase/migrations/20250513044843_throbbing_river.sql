/*
  # Database Schema for AutoAttend

  1. New Tables
    - `students`
      - `id` (uuid, primary key)
      - `name` (text)
      - `student_id` (text, unique)
      - `course` (text)
      - `photo_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `attendance`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key)
      - `course` (text)
      - `status` (text, enum: present/absent)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create students table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    student_id text NOT NULL UNIQUE,
    course text NOT NULL,
    photo_url text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create attendance table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.students(id),
    course text NOT NULL,
    status text NOT NULL CHECK (status IN ('present', 'absent')),
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can read students" ON public.students;
    DROP POLICY IF EXISTS "Authenticated users can insert students" ON public.students;
    DROP POLICY IF EXISTS "Authenticated users can update students" ON public.students;
    
    DROP POLICY IF EXISTS "Authenticated users can read attendance" ON public.attendance;
    DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON public.attendance;
    DROP POLICY IF EXISTS "Authenticated users can update attendance" ON public.attendance;
EXCEPTION
    WHEN undefined_object THEN 
END $$;

-- Create policies for students table
CREATE POLICY "Authenticated users can read students"
    ON public.students
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert students"
    ON public.students
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update students"
    ON public.students
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policies for attendance table
CREATE POLICY "Authenticated users can read attendance"
    ON public.attendance
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert attendance"
    ON public.attendance
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
    ON public.attendance
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);