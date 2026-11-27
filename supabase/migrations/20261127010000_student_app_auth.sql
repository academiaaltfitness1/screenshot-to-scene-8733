-- ALT ALUNO: vínculo seguro entre matrícula e usuário Supabase Auth.
-- Não altera nem remove alunos, matrículas, matrículas financeiras ou treinos existentes.
create table if not exists public.student_accounts (
  user_id uuid not null unique references auth.users(id) on delete cascade,
  student_id uuid not null unique references public.students(id),
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint student_accounts_pkey primary key (student_id)
);

create table if not exists public.student_auth_attempts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  kind text not null check (kind in ('login', 'activation', 'otp_resend', 'password_reset')),
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists student_auth_attempts_rate_limit_idx
  on public.student_auth_attempts (key, kind, created_at desc);

alter table public.student_accounts enable row level security;
alter table public.student_auth_attempts enable row level security;

revoke all on table public.student_accounts from anon, authenticated;
revoke all on table public.student_auth_attempts from anon, authenticated;
grant all on table public.student_accounts to service_role;
grant all on table public.student_auth_attempts to service_role;

-- PIN de 4 dígitos: somente hash com salt, nunca senha em texto puro.
alter table public.student_accounts add column if not exists pin_hash text;
