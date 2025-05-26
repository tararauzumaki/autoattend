/*
  # Add descriptor column to students table

  1. Changes
    - Add descriptor column to store facial recognition data
    - Column type is JSONB to store the facial descriptor array
    - Add index on descriptor column for better query performance
*/

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS descriptor JSONB;

CREATE INDEX IF NOT EXISTS students_descriptor_idx ON students USING GIN (descriptor);