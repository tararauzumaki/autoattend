/*
  # Initial schema setup for AutoAttend application

  1. New Tables
    - `students` - Stores student information with facial recognition data
    - `attendance` - Records attendance data for each student
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to perform CRUD operations
*/

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  student_id text NOT NULL UNIQUE,
  course text NOT NULL,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  course text NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on students table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Enable RLS on attendance table
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read students
CREATE POLICY "Authenticated users can read students"
  ON students
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert students
CREATE POLICY "Authenticated users can insert students"
  ON students
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update students
CREATE POLICY "Authenticated users can update students"
  ON students
  FOR UPDATE
  TO authenticated
  USING (true);

-- Policy for authenticated users to read attendance
CREATE POLICY "Authenticated users can read attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert attendance
CREATE POLICY "Authenticated users can insert attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update attendance
CREATE POLICY "Authenticated users can update attendance"
  ON attendance
  FOR UPDATE
  TO authenticated
  USING (true);