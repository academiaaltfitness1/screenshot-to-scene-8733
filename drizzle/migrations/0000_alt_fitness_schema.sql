
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  cargo text NOT NULL DEFAULT 'Recepção',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.employee_permissions (
  user_id uuid NOT NULL,
  module text NOT NULL,
  PRIMARY KEY (user_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_permissions TO authenticated;
GRANT ALL ON public.employee_permissions TO service_role;
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = auth.uid() AND p.active
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access(_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR (public.is_staff() AND EXISTS (
      SELECT 1 FROM public.employee_permissions WHERE user_id = auth.uid() AND module = _module
    ))
$$;

CREATE OR REPLACE FUNCTION public.setup_needed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.setup_needed() TO anon, authenticated;

CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff());
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "read own or admin roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "read own or admin perms" ON public.employee_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage perms" ON public.employee_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- First user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, cargo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email,
          CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN 'Administrador' ELSE 'Recepção' END)
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SETTINGS
CREATE TABLE public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gym_name text NOT NULL DEFAULT 'ACADEMIA ALT FITNESS',
  pix_key text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  tolerance_days integer NOT NULL DEFAULT 5,
  bill_alert_days integer NOT NULL DEFAULT 3,
  turnstile_model text NOT NULL DEFAULT 'Henry Primme Acesso SF',
  turnstile_firmware text NOT NULL DEFAULT '2.0.26',
  turnstile_ip text NOT NULL DEFAULT '192.168.0.229',
  turnstile_port integer NOT NULL DEFAULT 3000,
  release_seconds integer NOT NULL DEFAULT 5,
  fingerprint_rule text NOT NULL DEFAULT 'CONSULTAR NÚMERO DE MATRÍCULA',
  keypad_rule text NOT NULL DEFAULT 'CONSULTAR NÚMERO DE MATRÍCULA',
  allow_qrcode boolean NOT NULL DEFAULT true,
  allow_password boolean NOT NULL DEFAULT true,
  allow_matricula boolean NOT NULL DEFAULT true,
  allow_card boolean NOT NULL DEFAULT true,
  block_inactive boolean NOT NULL DEFAULT true,
  welcome_message text NOT NULL DEFAULT 'Bem-vindo',
  local_agent_url text NOT NULL DEFAULT 'http://localhost:3001',
  system_url text NOT NULL DEFAULT '',
  agent_last_seen timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read settings" ON public.settings FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "sistema update settings" ON public.settings FOR UPDATE TO authenticated
  USING (public.can_access('sistema') OR public.can_access('catraca'))
  WITH CHECK (public.can_access('sistema') OR public.can_access('catraca'));
INSERT INTO public.settings (id) VALUES (1);

CREATE TABLE public.agent_credentials (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex')
);
GRANT SELECT, UPDATE ON public.agent_credentials TO authenticated;
GRANT ALL ON public.agent_credentials TO service_role;
ALTER TABLE public.agent_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin agent token" ON public.agent_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.agent_credentials (id) VALUES (1);

-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  modality text NOT NULL DEFAULT 'Musculação',
  months integer NOT NULL DEFAULT 1,
  price numeric(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read plans" ON public.plans FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "mat insert plans" ON public.plans FOR INSERT TO authenticated WITH CHECK (public.can_access('matriculas'));
CREATE POLICY "mat update plans" ON public.plans FOR UPDATE TO authenticated USING (public.can_access('matriculas')) WITH CHECK (public.can_access('matriculas'));
CREATE POLICY "admin delete plans" ON public.plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.plans (name, modality, months, price) VALUES
  ('Mensal Musculação', 'Musculação', 1, 100),
  ('Trimestral Musculação', 'Musculação', 3, 270),
  ('Semestral Musculação', 'Musculação', 6, 510),
  ('Anual Musculação', 'Musculação', 12, 960),
  ('Mensal Muay Thai', 'Muay Thai', 1, 120);

-- STUDENTS
CREATE SEQUENCE public.students_matricula_seq START 1001;
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula integer NOT NULL UNIQUE DEFAULT nextval('public.students_matricula_seq'),
  name text NOT NULL,
  cpf text,
  birth_date date,
  gender text,
  whatsapp text,
  email text,
  address text,
  photo_url text,
  access_password text UNIQUE,
  card_number text UNIQUE,
  qr_code text NOT NULL UNIQUE DEFAULT lpad((floor(random() * 9000000000) + 1000000000)::bigint::text, 10, '0'),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  medical_notes text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.students_matricula_seq OWNED BY public.students.matricula;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT USAGE ON SEQUENCE public.students_matricula_seq TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read students" ON public.students FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "alunos insert" ON public.students FOR INSERT TO authenticated WITH CHECK (public.can_access('alunos'));
CREATE POLICY "alunos update" ON public.students FOR UPDATE TO authenticated USING (public.can_access('alunos')) WITH CHECK (public.can_access('alunos'));
CREATE POLICY "admin delete students" ON public.students FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ENROLLMENTS
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL DEFAULT '',
  modality text NOT NULL DEFAULT 'Musculação',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.enrollments (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read enrollments" ON public.enrollments FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "mat insert" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (public.can_access('matriculas'));
CREATE POLICY "mat update" ON public.enrollments FOR UPDATE TO authenticated USING (public.can_access('matriculas')) WITH CHECK (public.can_access('matriculas'));
CREATE POLICY "admin delete enrollments" ON public.enrollments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- CLASSES
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  modality text NOT NULL DEFAULT 'Muay Thai',
  weekdays text NOT NULL DEFAULT 'Seg, Qua, Sex',
  start_time time NOT NULL DEFAULT '19:00',
  end_time time NOT NULL DEFAULT '20:00',
  capacity integer NOT NULL DEFAULT 20,
  instructor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read classes" ON public.classes FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "turmas insert" ON public.classes FOR INSERT TO authenticated WITH CHECK (public.can_access('turmas'));
CREATE POLICY "turmas update" ON public.classes FOR UPDATE TO authenticated USING (public.can_access('turmas')) WITH CHECK (public.can_access('turmas'));
CREATE POLICY "admin delete classes" ON public.classes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.class_students (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_students TO authenticated;
GRANT ALL ON public.class_students TO service_role;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read class_students" ON public.class_students FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "turmas manage class_students" ON public.class_students FOR ALL TO authenticated USING (public.can_access('turmas')) WITH CHECK (public.can_access('turmas'));

-- ATTENDANCE
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  credential text,
  direction text NOT NULL DEFAULT 'entrada' CHECK (direction IN ('entrada', 'saida')),
  allowed boolean NOT NULL DEFAULT true,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.attendance (occurred_at DESC);
CREATE INDEX ON public.attendance (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freq read" ON public.attendance FOR SELECT TO authenticated USING (public.can_access('frequencia') OR public.can_access('catraca'));
CREATE POLICY "freq insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.can_access('frequencia') OR public.can_access('catraca'));
CREATE POLICY "admin delete attendance" ON public.attendance FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- TURNSTILE COMMANDS (remote manual release)
CREATE TABLE public.turnstile_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command text NOT NULL DEFAULT 'liberar',
  direction text NOT NULL DEFAULT 'entrada',
  requested_by uuid,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.turnstile_commands TO authenticated;
GRANT ALL ON public.turnstile_commands TO service_role;
ALTER TABLE public.turnstile_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catraca read cmds" ON public.turnstile_commands FOR SELECT TO authenticated USING (public.can_access('catraca'));
CREATE POLICY "catraca insert cmds" ON public.turnstile_commands FOR INSERT TO authenticated WITH CHECK (public.can_access('catraca') AND requested_by = auth.uid());

-- PRODUCTS & SALES
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read products" ON public.products FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "produtos insert" ON public.products FOR INSERT TO authenticated WITH CHECK (public.can_access('produtos'));
CREATE POLICY "produtos update" ON public.products FOR UPDATE TO authenticated USING (public.can_access('produtos') OR public.can_access('vendas')) WITH CHECK (public.can_access('produtos') OR public.can_access('vendas'));
CREATE POLICY "admin delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.products (name, category, price, cost, stock) VALUES
  ('Água 500ml', 'Bebidas', 3, 1, 48),
  ('Diária', 'Serviços', 20, 0, 9999),
  ('Camiseta ALT FITNESS', 'Vestuário', 49.9, 25, 20),
  ('Whey Protein (dose)', 'Suplementos', 8, 3, 60);

CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid,
  opening_amount numeric(10,2) NOT NULL DEFAULT 0,
  closed_at timestamptz,
  closed_by uuid,
  closing_amount numeric(10,2),
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash read" ON public.cash_sessions FOR SELECT TO authenticated USING (public.can_access('caixa') OR public.can_access('vendas') OR public.can_access('receber') OR public.can_access('pagar'));
CREATE POLICY "cash insert" ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (public.can_access('caixa'));
CREATE POLICY "cash update" ON public.cash_sessions FOR UPDATE TO authenticated USING (public.can_access('caixa')) WITH CHECK (public.can_access('caixa'));
CREATE POLICY "admin delete cash" ON public.cash_sessions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entrada', 'saida')),
  amount numeric(10,2) NOT NULL,
  method text NOT NULL DEFAULT 'Dinheiro',
  description text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movs read" ON public.cash_movements FOR SELECT TO authenticated USING (public.can_access('caixa'));
CREATE POLICY "movs insert" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (public.can_access('caixa') OR public.can_access('vendas') OR public.can_access('receber') OR public.can_access('pagar'));
CREATE POLICY "admin delete movs" ON public.cash_movements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Dinheiro',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendas read" ON public.sales FOR SELECT TO authenticated USING (public.can_access('vendas') OR public.can_access('relatorios'));
CREATE POLICY "vendas insert" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.can_access('vendas'));
CREATE POLICY "admin delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items read" ON public.sale_items FOR SELECT TO authenticated USING (public.can_access('vendas') OR public.can_access('relatorios'));
CREATE POLICY "items insert" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (public.can_access('vendas'));
CREATE POLICY "admin delete items" ON public.sale_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_items_stock AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock();

-- RECEIVABLES / PAYABLES
CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT 'Mensalidade',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at timestamptz,
  paid_amount numeric(10,2),
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.receivables (student_id);
CREATE INDEX ON public.receivables (due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.receivables TO service_role;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receber read" ON public.receivables FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "receber insert" ON public.receivables FOR INSERT TO authenticated WITH CHECK (public.can_access('receber') OR public.can_access('matriculas'));
CREATE POLICY "receber update" ON public.receivables FOR UPDATE TO authenticated USING (public.can_access('receber')) WITH CHECK (public.can_access('receber'));
CREATE POLICY "admin delete receivables" ON public.receivables FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  supplier text,
  category text NOT NULL DEFAULT 'Despesas gerais',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagar read" ON public.payables FOR SELECT TO authenticated USING (public.can_access('pagar') OR public.can_access('relatorios'));
CREATE POLICY "pagar insert" ON public.payables FOR INSERT TO authenticated WITH CHECK (public.can_access('pagar'));
CREATE POLICY "pagar update" ON public.payables FOR UPDATE TO authenticated USING (public.can_access('pagar')) WITH CHECK (public.can_access('pagar'));
CREATE POLICY "admin delete payables" ON public.payables FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ASSESSMENTS
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assessed_at date NOT NULL DEFAULT CURRENT_DATE,
  weight numeric(6,2),
  height numeric(4,2),
  body_fat numeric(5,2),
  muscle_mass numeric(6,2),
  chest numeric(6,2),
  waist numeric(6,2),
  abdomen numeric(6,2),
  hip numeric(6,2),
  arm_right numeric(6,2),
  arm_left numeric(6,2),
  thigh_right numeric(6,2),
  thigh_left numeric(6,2),
  calf numeric(6,2),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.assessments (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aval read" ON public.assessments FOR SELECT TO authenticated USING (public.can_access('avaliacao'));
CREATE POLICY "aval insert" ON public.assessments FOR INSERT TO authenticated WITH CHECK (public.can_access('avaliacao'));
CREATE POLICY "aval update" ON public.assessments FOR UPDATE TO authenticated USING (public.can_access('avaliacao')) WITH CHECK (public.can_access('avaliacao'));
CREATE POLICY "admin delete assessments" ON public.assessments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- WORKOUTS
CREATE TABLE public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  letter text NOT NULL DEFAULT 'A',
  name text NOT NULL DEFAULT 'Treino A',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.workouts (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treinos read" ON public.workouts FOR SELECT TO authenticated USING (public.can_access('treinos'));
CREATE POLICY "treinos insert" ON public.workouts FOR INSERT TO authenticated WITH CHECK (public.can_access('treinos'));
CREATE POLICY "treinos update" ON public.workouts FOR UPDATE TO authenticated USING (public.can_access('treinos')) WITH CHECK (public.can_access('treinos'));
CREATE POLICY "treinos delete" ON public.workouts FOR DELETE TO authenticated USING (public.can_access('treinos'));

CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise text NOT NULL,
  sets text NOT NULL DEFAULT '3',
  reps text NOT NULL DEFAULT '12',
  load text NOT NULL DEFAULT '',
  rest text NOT NULL DEFAULT '60s',
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX ON public.workout_exercises (workout_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ex read" ON public.workout_exercises FOR SELECT TO authenticated USING (public.can_access('treinos'));
CREATE POLICY "ex manage" ON public.workout_exercises FOR ALL TO authenticated USING (public.can_access('treinos')) WITH CHECK (public.can_access('treinos'));

-- OVERVIEW VIEW (situation for UI and agent)
CREATE VIEW public.student_overview WITH (security_invoker = on) AS
SELECT s.*,
  (SELECT max(e.end_date) FROM public.enrollments e WHERE e.student_id = s.id AND e.status = 'ativa') AS valid_until,
  (SELECT min(r.due_date) FROM public.receivables r WHERE r.student_id = s.id AND r.paid_at IS NULL) AS overdue_since
FROM public.students s;
GRANT SELECT ON public.student_overview TO authenticated;
GRANT SELECT ON public.student_overview TO service_role;
