-- Create meeting room bookings table
CREATE TABLE public.meeting_room_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Enable RLS
ALTER TABLE public.meeting_room_bookings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuários aprovados podem ver reservas"
ON public.meeting_room_bookings
FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem criar reservas"
ON public.meeting_room_bookings
FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Usuários podem atualizar suas próprias reservas"
ON public.meeting_room_bookings
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar suas próprias reservas"
ON public.meeting_room_bookings
FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Admins podem gerenciar todas as reservas"
ON public.meeting_room_bookings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient date queries
CREATE INDEX idx_meeting_room_bookings_date ON public.meeting_room_bookings(booking_date);

-- Trigger for updated_at
CREATE TRIGGER update_meeting_room_bookings_updated_at
  BEFORE UPDATE ON public.meeting_room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();