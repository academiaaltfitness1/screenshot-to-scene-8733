import type { LucideIcon } from "lucide-react";
import {
  Users,
  ClipboardList,
  CalendarCheck,
  CalendarClock,
  IdCard,
  Package,
  ShoppingCart,
  HandCoins,
  Receipt,
  Wallet,
  Ruler,
  Dumbbell,
  Settings,
  DatabaseBackup,
  DoorOpen,
  BarChart3,
  Megaphone,
} from "lucide-react";

export type ModuleKey =
  | "alunos"
  | "matriculas"
  | "frequencia"
  | "turmas"
  | "funcionarios"
  | "produtos"
  | "vendas"
  | "receber"
  | "pagar"
  | "caixa"
  | "avaliacao"
  | "treinos"
  | "sistema"
  | "backup"
  | "catraca"
  | "relatorios"
  | "comunicados";

export type ModulePath =
  | "/alunos"
  | "/matriculas"
  | "/frequencia"
  | "/turmas"
  | "/funcionarios"
  | "/produtos"
  | "/venda"
  | "/receber"
  | "/pagar"
  | "/caixa"
  | "/avaliacao"
  | "/treinos"
  | "/sistema"
  | "/backup"
  | "/catraca"
  | "/relatorios"
  | "/comunicados";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  title: string;
  path: ModulePath;
  icon: LucideIcon;
  fkey?: string;
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  alunos: { key: "alunos", label: "Alunos", title: "Cadastro de Alunos", path: "/alunos", icon: Users, fkey: "F1" },
  matriculas: { key: "matriculas", label: "Matrículas", title: "Controle de Matrículas", path: "/matriculas", icon: ClipboardList, fkey: "F2" },
  frequencia: { key: "frequencia", label: "Frequência", title: "Controle de Frequência", path: "/frequencia", icon: CalendarCheck, fkey: "F3" },
  turmas: { key: "turmas", label: "Turmas", title: "Controle de Turmas", path: "/turmas", icon: CalendarClock, fkey: "F4" },
  funcionarios: { key: "funcionarios", label: "Funcionários", title: "Cadastro de Funcionários", path: "/funcionarios", icon: IdCard, fkey: "F5" },
  produtos: { key: "produtos", label: "Produtos", title: "Cadastro de Produtos", path: "/produtos", icon: Package, fkey: "F6" },
  vendas: { key: "vendas", label: "Venda", title: "Venda de Produtos", path: "/venda", icon: ShoppingCart, fkey: "F7" },
  receber: { key: "receber", label: "A Receber", title: "Contas a Receber", path: "/receber", icon: HandCoins, fkey: "F8" },
  pagar: { key: "pagar", label: "A Pagar", title: "Contas a Pagar", path: "/pagar", icon: Receipt, fkey: "F9" },
  caixa: { key: "caixa", label: "Caixa", title: "Controle do Caixa", path: "/caixa", icon: Wallet, fkey: "F10" },
  avaliacao: { key: "avaliacao", label: "Avaliação", title: "Avaliação Física", path: "/avaliacao", icon: Ruler, fkey: "F11" },
  treinos: { key: "treinos", label: "Treinos", title: "Prescrição de Treinos", path: "/treinos", icon: Dumbbell, fkey: "F12" },
  sistema: { key: "sistema", label: "Sistema", title: "Configurações do Sistema", path: "/sistema", icon: Settings },
  backup: { key: "backup", label: "Backup", title: "Backup dos Dados", path: "/backup", icon: DatabaseBackup },
  catraca: { key: "catraca", label: "Catraca", title: "Catraca Henry", path: "/catraca", icon: DoorOpen },
  relatorios: { key: "relatorios", label: "Relatórios", title: "Relatórios", path: "/relatorios", icon: BarChart3 },
  comunicados: { key: "comunicados", label: "Comunicados", title: "Comunicados e promoções", path: "/comunicados", icon: Megaphone },
};

/** The 12 toolbar buttons, in SCA Fit order (Sair is rendered separately). */
export const TOOLBAR: ModuleKey[] = [
  "alunos",
  "matriculas",
  "frequencia",
  "funcionarios",
  "vendas",
  "caixa",
  "receber",
  "pagar",
  "sistema",
  "backup",
  "catraca",
];

/** F1–F12 shortcut order. */
export const SHORTCUTS: ModuleKey[] = [
  "alunos",
  "matriculas",
  "frequencia",
  "turmas",
  "funcionarios",
  "produtos",
  "vendas",
  "receber",
  "pagar",
  "caixa",
  "avaliacao",
  "treinos",
];

export const ALL_MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];
