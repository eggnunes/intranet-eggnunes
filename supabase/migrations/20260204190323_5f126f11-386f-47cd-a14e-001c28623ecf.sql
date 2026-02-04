-- Update RLS policies for feedback_box to allow users to see their own messages

-- Add policy for users to see their OWN sent messages
CREATE POLICY "Users can view their own sent messages"
  ON feedback_box
  FOR SELECT
  USING (sender_id = auth.uid());

-- Update feedback_replies policies to let users see replies to their own messages
CREATE POLICY "Users can see replies to their own feedback"
  ON feedback_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM feedback_box fb
      WHERE fb.id = feedback_replies.feedback_id
      AND fb.sender_id = auth.uid()
    )
  );

-- Allow sócios (partners) to manage feedback_box
CREATE OR REPLACE FUNCTION public.is_socio(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND position = 'socio'
    AND approval_status = 'approved'
  )
$$;

-- Create policy for sócios to view all messages
CREATE POLICY "Sócios can view all messages"
  ON feedback_box
  FOR SELECT
  USING (is_socio(auth.uid()));

-- Create policy for sócios to update messages
CREATE POLICY "Sócios can update messages"
  ON feedback_box
  FOR UPDATE
  USING (is_socio(auth.uid()));

-- Create policy for sócios to delete messages
CREATE POLICY "Sócios can delete messages"
  ON feedback_box
  FOR DELETE
  USING (is_socio(auth.uid()));

-- Create policy for sócios to manage replies
CREATE POLICY "Sócios can manage all replies"
  ON feedback_replies
  FOR ALL
  USING (is_socio(auth.uid()));
