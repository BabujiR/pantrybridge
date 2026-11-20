import { useSyncExternalStore } from 'react';

const ES: Record<string, string> = {
  Dashboard: 'Panel', Home: 'Inicio', 'Check-In': 'Registro', 'Client Search': 'Buscar cliente', Help: 'Ayuda',
  Clients: 'Clientes', Distribution: 'Distribución', Pantry: 'Despensa', Appointments: 'Citas', Reports: 'Informes',
  Settings: 'Configuración', 'Sign out': 'Cerrar sesión', 'Switch role': 'Cambiar rol', 'Guided Tour': 'Recorrido guiado',
  'Reset demo data': 'Restablecer datos', 'Demo Script': 'Guion de demo', 'Check In': 'Registrar',
  'Search by name, phone, or Client ID': 'Buscar por nombre, teléfono o ID', 'Register Client': 'Registrar cliente',
  'Households checked in': 'Hogares registrados', 'People served': 'Personas atendidas', 'Quick Register': 'Registro rápido',
  'Client not found?': '¿No encuentra al cliente?', 'Recent check-ins': 'Registros recientes', Confirm: 'Confirmar', Cancel: 'Cancelar',
  'Total clients': 'Clientes totales', 'Total households': 'Hogares totales', Save: 'Guardar', Next: 'Siguiente', Back: 'Atrás',
  'Bridging families to food and services.': 'Conectando familias con alimentos y servicios.',
  'Demo: Sign in as…': 'Demo: Entrar como…', 'Sign in': 'Entrar', Email: 'Correo', Password: 'Contraseña',
  'Confirm Check-In': 'Confirmar registro', 'Household size today': 'Tamaño del hogar hoy', 'Food categories': 'Categorías de alimentos',
};

let lang: 'en' | 'es' = (() => { try { return (localStorage.getItem('pantrybridge.lang') as any) || 'en'; } catch { return 'en'; } })();
const subs = new Set<() => void>();
export function useLang() { return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => lang); }
export function setLang(l: 'en' | 'es') {
  lang = l;
  try { localStorage.setItem('pantrybridge.lang', l); } catch { /* ignore */ }
  subs.forEach(f => f());
}
export function t(s: string): string { return lang === 'es' ? (ES[s] || s) : s; }
