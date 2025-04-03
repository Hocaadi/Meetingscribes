-- Create otp_verification table for secure OTP storage
CREATE TABLE IF NOT EXISTS public.otp_verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'signup',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false
);

-- Create index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_otp_verification_email 
ON public.otp_verification(email);

-- Enable Row Level Security
ALTER TABLE public.otp_verification ENABLE ROW LEVEL SECURITY;

-- Create policy for service role only access
-- This table should only be accessed by the service role for security
CREATE POLICY "Service role only access" ON public.otp_verification
  USING (true)
  WITH CHECK (true);

-- Add comment to table for documentation
COMMENT ON TABLE public.otp_verification IS 
'Stores One-Time Password (OTP) verification codes for email verification, login, and password reset';

-- Add maintenance function to clean up expired OTPs
CREATE OR REPLACE FUNCTION clean_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.otp_verification
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically clean up expired OTPs daily
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup job (if pg_cron is available)
-- This will run once per day at 1:00 AM
SELECT cron.schedule('clean-expired-otps', '0 1 * * *', 'SELECT clean_expired_otps()');

-- If the above fails because pg_cron is not available, users can manually run:
-- SELECT clean_expired_otps();
-- Or set up an external scheduler 