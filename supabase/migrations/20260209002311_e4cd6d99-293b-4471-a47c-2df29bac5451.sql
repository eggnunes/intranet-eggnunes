
-- Add transcription column to whatsapp_messages
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS transcription text;

-- Add sent_by_name for quick display (denormalized for performance)
-- sent_by already exists, we'll use profiles join
