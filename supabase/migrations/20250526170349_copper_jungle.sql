/*
  # Enable Storage RLS policies

  1. Changes
    - Enable RLS for storage.objects table
    - Add policies to allow authenticated users to manage images
*/

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

CREATE POLICY "Allow authenticated users to read images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'images');

CREATE POLICY "Allow authenticated users to update images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'images');

CREATE POLICY "Allow authenticated users to delete images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'images');