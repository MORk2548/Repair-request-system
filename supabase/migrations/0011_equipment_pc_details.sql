-- One row is one workstation as on the paper inventory: the PC (name, model, serial_no) and its monitor, plus who uses it.
-- user_name is free text because the person who sits at a machine often has no account here.
alter table public.equipment
  add column model text,
  add column monitor_model text,
  add column monitor_serial_no text,
  add column user_name text;
