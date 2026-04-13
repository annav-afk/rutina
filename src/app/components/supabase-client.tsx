import { createClient } from "@supabase/supabase-js";

export const projectId = "bjhsgjsxhvwtuerahuha";
export const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaHNnanN4aHZ3dHVlcmFodWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjkzMzksImV4cCI6MjA4MTA0NTMzOX0.scy473dsh6hy8hjeUB-mo1D8l8J0Mu8WYXVfSW_cK6s";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
);