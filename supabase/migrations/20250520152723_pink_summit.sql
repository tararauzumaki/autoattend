/*
  # Update RLS policies for students and storage

  1. Changes
    - Update RLS policies for students table to allow authenticated users to insert records
    - Add storage bucket policies for images to allow authenticated users to upload files

  2. Security
    - Enable RLS on students table (already enabled)
    - Add policy for authenticated users to insert student records
    - Add storage bucket policies for authenticated users
*/

-- Update students table policies
CREATE POLICY "Enable insert for authenticated users only"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create storage bucket if it doesn't exist and set up policies
DO $$
BEGIN
  -- Create images bucket if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'images'
  ) THEN
    INSERT INTO storage.buckets (id, name)
    VALUES ('images', 'images');
  END IF;
END $$;

-- Storage bucket policies
CREATE POLICY "Enable read access for authenticated users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'images');

CREATE POLICY "Enable insert access for authenticated users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = 'students'
);