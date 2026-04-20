/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, 
  Image as ImageIcon, 
  Upload, 
  Play, 
  Pause,
  Square,
  Settings, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Download, 
  Trash2,
  Mic,
  Maximize2,
  FileText,
  Zap,
  LogOut,
  User,
  Package,
  ShoppingBag,
  AlertCircle,
  Globe,
  X,
  Wand2,
  Palette,
  ImagePlus,
  Maximize,
  LayoutDashboard,
  Briefcase,
  Library,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Copy,
  Gift,
  HelpCircle,
  CreditCard,
  Mail,
  ShieldCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Home,
  Target,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { LandingPage } from './components/LandingPage';

// --- Utilities ---
const resizeImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64Str}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // White background for transparent PNGs converted to JPEG
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
    };
    img.onerror = () => resolve(base64Str);
  });
};

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      let errorDetails = "";

      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) {
          errorMessage = "Erro no Banco de Dados: " + parsed.error;
          errorDetails = JSON.stringify(parsed, null, 2);
        }
      } catch (e) {
        errorMessage = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#111] border border-red-500/20 p-8 rounded-[2rem] shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-black text-white mb-4">Ops! Algo deu errado</h2>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              {errorMessage}
            </p>
            {errorDetails && (
              <pre className="text-[10px] font-mono text-red-400 bg-red-500/5 p-4 rounded-xl mb-6 overflow-auto max-h-40 text-left">
                {errorDetails}
              </pre>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black font-black py-4 rounded-xl hover:scale-105 transition-all"
            >
              RECARREGAR APLICATIVO
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  deleteField,
  query, 
  orderBy,
  increment,
  where,
  getDocs,
  handleFirestoreError,
  OperationType,
  FirebaseUser,
  storage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from './firebase';

// --- Types ---
interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  photoURL: string | null;
  role: string;
  credits: number;
  plan: string;
  createdAt: any;
  isVerified: boolean;
  verificationCode?: string;
  referralCode: string;
  referredBy?: string | null;
  referralCount: number;
}

interface BatchItem {
  id: string;
  type: 'video' | 'image' | 'lipsync';
  sourceTab: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  aspectRatio: string;
  resolution: string;
  previewUrl?: string;
  progress: number;
  duration?: number;
  createdAt: any;
  completedAt?: any;
  error?: string;
  lowPriority?: boolean;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

// --- Constants ---
const CREATIVE_STRATEGIES = [
  { id: 'oferta', name: 'Oferta Direta', description: 'Vendas, preço e urgência.' },
  { id: 'autoridade', name: 'Autoridade', description: 'Marca pessoal e especialista.' },
  { id: 'prova_social', name: 'Prova Social', description: 'Antes e depois, depoimentos.' },
  { id: 'educativo', name: 'Educativo', description: 'Dicas e carrossel.' },
  { id: 'engajamento', name: 'Engajamento', description: 'Rápido (Reels/TikTok).' },
  { id: 'depoimento', name: 'Depoimento', description: 'Validação de clientes.' },
  { id: 'polemica', name: 'Polêmica Suave', description: 'Debates e opiniões.' }
];

const CREATIVE_AESTHETICS = [
  { id: 'minimalista', name: 'Minimalista', description: 'Clean e profissional.' },
  { id: 'vibrante', name: 'Vibrante', description: 'Cores fortes e energia.' },
  { id: 'pastel', name: 'Pastel/Soft', description: 'Suave e acolhedor.' },
  { id: 'retro', name: 'Retro/Vintage', description: 'Nostálgico e estiloso.' },
  { id: 'dark', name: 'Dark Mode', description: 'Fundo escuro e neon.' },
  { id: '3d', name: '3D/Ilustrativo', description: 'Personagens e profundidade.' },
  { id: 'trendy', name: 'Trendy', description: 'Estética TikTok/K-pop.' }
];

function Timer({ start, end, status }: { start: any; end?: any; status: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!start) return;
    
    const startTime = start.toDate ? start.toDate().getTime() : new Date(start).getTime();
    
    if (status === 'completed' && end) {
      const endTime = end.toDate ? end.toDate().getTime() : new Date(end).getTime();
      setElapsed(Math.max(0, Math.round((endTime - startTime) / 1000)));
      return;
    }

    if (status === 'processing' || status === 'pending') {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        setElapsed(Math.max(0, Math.round((now - startTime) / 1000)));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [start, end, status]);

  return (
    <span className="flex items-center gap-1 text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
      <Clock size={10} />
      {elapsed}s
    </span>
  );
}

// --- Legal & Contact Modal ---
function LegalModal({ tab, onClose }: { tab: 'terms' | 'privacy' | 'contact', onClose: () => void }) {
  const content = {
    terms: {
      title: "Termos de Uso",
      sections: [
        { h: "1. Aceitação", p: "Ao usar a Lumina, você aceita estes termos integralmente." },
        { h: "2. Serviços", p: "Geração de conteúdo via IA. O uso de créditos é definitivo." },
        { h: "3. Propriedade", p: "O usuário retém direitos sobre prompts, a Lumina sobre a infraestrutura." },
        { h: "4. Regras", p: "Proibido conteúdo ilegal, ofensivo ou infrator." }
      ]
    },
    privacy: {
      title: "Política de Privacidade",
      sections: [
        { h: "1. Coleta", p: "Coletamos e-mail, nome e logs de geração para melhoria do serviço." },
        { h: "2. Uso", p: "Seus dados não são vendidos. Usamos criptografia de ponta." },
        { h: "3. Cookies", p: "Utilizamos cookies apenas para manter sua sessão ativa." },
        { h: "4. LGPD", p: "Garantimos todos os direitos previstos na Lei Geral de Proteção de Dados." }
      ]
    },
    contact: {
      title: "Canais de Atendimento",
      sections: [
        { h: "Suporte Técnico", p: "Disponível 24/7 para assinantes Pro e Elite." },
        { h: "E-mail Oficial", p: "luminaaisolutions@gmail.com" },
        { h: "Escritório", p: "São Paulo, SP - Brasil" }
      ]
    }
  };

  const active = content[tab];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-2xl w-full bg-[#111] border border-[#222] p-8 md:p-12 rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#d4af37] via-[#f1c40f] to-[#d4af37]" />
        
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{active.title} <span className="text-[#d4af37]">Lumina</span></h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-4 space-y-6 text-gray-400 text-sm leading-relaxed custom-scrollbar">
          {active.sections.map((s, i) => (
            <section key={i} className="space-y-3 p-6 bg-white/5 rounded-3xl border border-white/5">
              <h3 className="text-[#d4af37] font-black uppercase tracking-widest text-xs">{s.h}</h3>
              <p>{s.p}</p>
              {s.h === "E-mail Oficial" && (
                <a 
                  href={`mailto:${s.p}`} 
                  className="inline-block mt-4 px-6 py-2 bg-[#d4af37] text-black font-black rounded-full text-[10px] hover:scale-105 transition-all"
                >
                  ENVIAR E-MAIL AGORA
                </a>
              )}
            </section>
          ))}
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-[1.02] transition-all mt-8 uppercase tracking-widest text-xs"
        >
          Fechar
        </button>
      </motion.div>
    </div>
  );
}

// --- Terms of Use Modal ---
function TermsModal({ onClose }: { onClose: () => void }) {
  return <LegalModal tab="terms" onClose={onClose} />;
}

// --- Registration Modal ---
function RegistrationModal({ data, onChange, onSubmit, onGoogleLogin, isProcessing, onBack, onViewTerms }: { 
  data: { firstName: string, lastName: string, phone: string, email: string, password?: string }, 
  onChange: (field: string, value: string) => void,
  onSubmit: () => void,
  onGoogleLogin?: () => void,
  isProcessing: boolean,
  onBack?: () => void,
  onViewTerms?: () => void
}) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-[#111] border border-[#222] p-10 rounded-[48px] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#d4af37] via-[#f1c40f] to-[#d4af37]" />
        
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#d4af37]/10 text-[#d4af37] rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-all duration-500">
            <User size={40} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Crie sua conta na <br/><span className="text-[#d4af37]">LUMINA ART CREATOR</span></h2>
          <p className="text-gray-500 text-sm">Para começar seu plano de teste gratuito e ganhar 40 créditos, precisamos de alguns dados básicos.</p>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome</label>
              <input 
                type="text" 
                value={data.firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
                placeholder="Ex: João"
                className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Sobrenome</label>
              <input 
                type="text" 
                value={data.lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
                placeholder="Ex: Silva"
                className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
            <input 
              type="email" 
              value={data.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all"
            />
          </div>

          {onBack && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative">
                <input 
                  type={showPass ? "text" : "password"} 
                  value={data.password || ''}
                  onChange={(e) => onChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 pr-12 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
            <input 
              type="tel" 
              value={data.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all"
            />
          </div>

          <button 
            onClick={onSubmit}
            disabled={isProcessing || !data.firstName || !data.lastName || !data.phone || !data.email || (onBack && !data.password)}
            className="w-full bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black py-5 rounded-2xl shadow-xl shadow-[#d4af37]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest mt-4 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isProcessing ? <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={20} />}
            FINALIZAR CADASTRO
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#222]"></div>
            </div>
            <div className="relative flex justify-center text-[8px] uppercase font-black tracking-widest">
              <span className="bg-[#111] px-4 text-gray-500">Ou continue com</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={onGoogleLogin}
            disabled={isProcessing}
            className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.39-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Google
          </button>

          {onBack && (
            <button 
              onClick={onBack}
              className="w-full text-gray-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all"
            >
              Já tenho uma conta? Entrar
            </button>
          )}
          
          <p className="text-[10px] text-gray-600 text-center mt-6 uppercase tracking-widest font-bold">
            Ao se cadastrar, você concorda com nossos <span onClick={onViewTerms} className="text-gray-400 underline cursor-pointer hover:text-[#d4af37] transition-colors">Termos de Uso</span>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// --- Login Modal ---
function LoginModal({ onLogin, onGoogleLogin, onSwitchToSignUp, onForgotPassword, isProcessing, isResetting }: { 
  onLogin: (email: string, pass: string) => void,
  onGoogleLogin?: () => void,
  onSwitchToSignUp: () => void,
  onForgotPassword: (email: string) => void,
  isProcessing: boolean,
  isResetting: boolean
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-[#111] border border-[#222] p-10 rounded-[48px] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#d4af37] via-[#f1c40f] to-[#d4af37]" />
        
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#d4af37]/10 text-[#d4af37] rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-all duration-500">
            <Zap size={40} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Bem-vindo de volta à <br/><span className="text-[#d4af37]">LUMINA</span></h2>
          <p className="text-gray-500 text-sm">Entre com seu e-mail e senha para continuar criando.</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Senha</label>
              <button 
                onClick={() => onForgotPassword(email)}
                disabled={isResetting}
                className="text-[10px] font-bold text-[#d4af37] hover:underline uppercase tracking-widest disabled:opacity-50"
              >
                {isResetting ? 'Enviando...' : 'Esqueceu a senha?'}
              </button>
            </div>
            <div className="relative">
              <input 
                type={showPass ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 pr-12 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            onClick={() => onLogin(email, password)}
            disabled={isProcessing || !email || !password}
            className="w-full bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black py-5 rounded-2xl shadow-xl shadow-[#d4af37]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest mt-4 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isProcessing ? <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={20} />}
            ENTRAR NO SISTEMA
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#222]"></div>
            </div>
            <div className="relative flex justify-center text-[8px] uppercase font-black tracking-widest">
              <span className="bg-[#111] px-4 text-gray-500">Ou continue com</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={onGoogleLogin}
            disabled={isProcessing}
            className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.39-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Google
          </button>

          <button 
            onClick={onSwitchToSignUp}
            className="w-full text-gray-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all"
          >
            Não tem uma conta? Cadastre-se
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AppContent() {
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({ message: '', type: null });

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(prev => prev.message === message ? { message: '', type: null } : prev), 5000);
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'landing' | 'app'>(localStorage.getItem('lumina_view') as any || 'landing');
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const isInternalNav = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastSentCode, setLastSentCode] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    localStorage.setItem('lumina_view', view);
  }, [view]);

  // --- Referral Check ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referredBy', ref);
    }
  }, []);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'branding' | 'projects' | 'creative_studio' | 'lipsync' | 'library' | 'plans' | 'profile' | 'referrals' | 'faq'>(localStorage.getItem('lumina_activeTab') as any || 'dashboard');

  useEffect(() => {
    localStorage.setItem('lumina_activeTab', activeTab);
  }, [activeTab]);

  const [libraryFilter, setLibraryFilter] = useState<'all' | 'image' | 'video'>('all');
  const [dragActive, setDragActive] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ 
    url: string; 
    type: 'image' | 'video'; 
    id?: string;
    index?: number;
    list?: any[];
  } | null>(null);

  const openPreview = (item: any, list: any[]) => {
    const url = sessionPreviews[item.id] || item.previewUrl;
    if (!url) return;
    const index = list.findIndex(i => i.id === item.id);
    setSelectedMedia({
      url,
      type: item.type === 'image' ? 'image' : 'video',
      id: item.id,
      index,
      list
    });
  };

  const navigatePreview = (direction: 'prev' | 'next', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedMedia) return;
    const { index, list } = selectedMedia;
    let newIndex = direction === 'next' ? index + 1 : index - 1;
    
    if (newIndex >= 0 && newIndex < list.length) {
      const newItem = list[newIndex];
      const url = sessionPreviews[newItem.id] || newItem.previewUrl;
      if (url) {
        setSelectedMedia({
          url,
          type: newItem.type === 'image' ? 'image' : 'video',
          id: newItem.id,
          index: newIndex,
          list
        });
      }
    }
  };
  
  // Form State
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<'video' | 'image'>('video');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [resolution, setResolution] = useState('1080p');
  const [modelType, setModelType] = useState<'nano' | 'imagen'>('nano');
  const [quantity, setQuantity] = useState(1);
  const [videoDuration, setVideoDuration] = useState(4); // Default 4s
  const [lipsyncDuration, setLipsyncDuration] = useState(4); // Default 4s
  const [lipsyncAspectRatio, setLipsyncAspectRatio] = useState('9:16');
  const [lipsyncResolution, setLipsyncResolution] = useState('1080p');
  const [lipsyncQuantity, setLipsyncQuantity] = useState(1);
  const [lipsyncLowPriority, setLipsyncLowPriority] = useState(false);
  const [useGrounding, setUseGrounding] = useState(false);
  const [useLipsync, setUseLipsync] = useState(false);

  // --- Creative Studio State ---
  const [useCreativeStudio, setUseCreativeStudio] = useState(false);
  const [creativeLogo, setCreativeLogo] = useState<{ data: string, mimeType: string } | null>(null);
  const [creativeRefAsset, setCreativeRefAsset] = useState<{ data: string, mimeType: string, type: 'image' } | null>(null);
  const [creativeProductAsset, setCreativeProductAsset] = useState<{ data: string, mimeType: string, type: 'image' } | null>(null);
  const [creativeColors, setCreativeColors] = useState<string[]>([]);
  const [creativeTypography, setCreativeTypography] = useState('Modern');
  const [creativeFormat, setCreativeFormat] = useState('Instagram Post 1:1');
  const [creativeQuantity, setCreativeQuantity] = useState(1);
  const [creativePrompt, setCreativePrompt] = useState('');
  const [creativeStrategy, setCreativeStrategy] = useState('Oferta Direta');
  const [creativeAesthetic, setCreativeAesthetic] = useState('Minimalista');
  const [adGoal, setAdGoal] = useState<'conversoes' | 'awareness' | 'engajamento' | 'lead'>('conversoes');
  const [adTrigger, setAdTrigger] = useState<'escassez' | 'autoridade' | 'curiosidade' | 'urgencia' | 'prova_social' | 'desejo'>('desejo');
  const [adPlatform, setAdPlatform] = useState<'tiktok' | 'instagram' | 'youtube' | 'facebook'>('instagram');
  const [isAnalyzingLogo, setIsAnalyzingLogo] = useState(false);
  const [brandProfiles, setBrandProfiles] = useState<{ 
    id: string, 
    name: string, 
    logos: { data: string, mimeType: string }[], 
    images: { data: string, mimeType: string }[],
    colors: string[], 
    typography: string,
    mission?: string,
    niche?: string,
    contact?: string,
    description?: string,
    styleAnalysis?: string,
    toneOfVoice?: string,
    detectedPalette?: string[]
  }[]>([]);
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);
  const [activeBrandProfileId, setActiveBrandProfileId] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'contact'>('terms');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // --- Navigation & History Sync ---
  useEffect(() => {
    // Initial state setup
    const initialState = { 
      view, 
      activeTab: localStorage.getItem('lumina_activeTab') || 'dashboard', 
      showLoginModal: false, 
      showRegistration: false, 
      showTerms: false, 
      hasPreview: false 
    };
    window.history.replaceState(initialState, '');

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state) {
        isInternalNav.current = true;
        setView(state.view);
        setActiveTab(state.activeTab);
        setShowLoginModal(state.showLoginModal);
        setShowRegistration(state.showRegistration);
        setShowTerms(state.showTerms);
        if (!state.hasPreview) setSelectedMedia(null);
        isInternalNav.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync state changes TO history
  useEffect(() => {
    if (isInternalNav.current) return;
    
    const newState = { 
      view, 
      activeTab, 
      showLoginModal, 
      showRegistration, 
      showTerms, 
      hasPreview: !!selectedMedia 
    };

    const currentState = window.history.state;
    // Basic check to avoid redundant history entries
    if (!currentState || 
        (currentState.view !== newState.view) || 
        (currentState.activeTab !== newState.activeTab) ||
        (currentState.showLoginModal !== newState.showLoginModal) ||
        (currentState.showRegistration !== newState.showRegistration) ||
        (currentState.showTerms !== newState.showTerms) ||
        (currentState.hasPreview !== newState.hasPreview)) {
      window.history.pushState(newState, '');
    }
  }, [view, activeTab, showLoginModal, showRegistration, showTerms, !!selectedMedia]);
  const [registrationData, setRegistrationData] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' });
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const registrationInitialized = useRef(false);
  const isSubmittingRegistration = useRef(false);
  const unsubUserRef = useRef<(() => void) | null>(null);
  const unsubBatchRef = useRef<(() => void) | null>(null);
  const unsubBrandsRef = useRef<(() => void) | null>(null);

  const handleEmailSignUp = async () => {
    if (!registrationData.email || !registrationData.password) return;
    setIsRegistering(true);
    isSubmittingRegistration.current = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registrationData.email, registrationData.password);
      const newUser = userCredential.user;
      
      const userRef = doc(db, 'users', newUser.uid);
      const refCode = Math.random().toString(36).substring(2, 9);
      const referredBy = localStorage.getItem('referredBy') || null;
      
      const initialData = {
        uid: newUser.uid,
        email: registrationData.email,
        displayName: `${registrationData.firstName} ${registrationData.lastName}`,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        phone: registrationData.phone,
        photoURL: null,
        role: registrationData.email === 'luminaaisolutions@gmail.com' ? 'admin' : 'user',
        credits: 0, 
        plan: 'trial',
        createdAt: new Date(),
        isVerified: false,
        referralCode: refCode,
        referredBy: referredBy,
        referralCount: 0
      };
      
      await setDoc(userRef, initialData);
      setUserData(initialData as any);
      
      // Delay UI switch slightly to ensure state is committed
      setTimeout(() => {
        setShowRegistration(false);
        setView('app');
      }, 500);
      
      // Trigger OTP flow
      await sendOTP(registrationData.email);
      localStorage.removeItem('referredBy');
    } catch (error: any) {
      console.error("Sign up failed:", error);
      showNotification(`Erro ao criar conta: ${error.message}`, "error");
    } finally {
      setIsRegistering(false);
      setTimeout(() => {
        isSubmittingRegistration.current = false;
      }, 3000);
    }
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setShowLoginModal(false);
      setView('app');
    } catch (error: any) {
      console.error("Login failed:", error);
      let message = "Erro ao entrar. Verifique suas credenciais.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "E-mail ou senha incorretos.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Muitas tentativas. Tente novamente mais tarde.";
      }
      showNotification(message, "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    if (!email) {
      showNotification("Por favor, digite seu e-mail primeiro.", "info");
      return;
    }
    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showNotification("E-mail de redefinição de senha enviado! Verifique sua caixa de entrada.", "success");
    } catch (error: any) {
      console.error("Reset failed:", error);
      showNotification(`Erro ao enviar e-mail: ${error.message}`, "error");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleRegister = async () => {
    // This is now handled by handleEmailSignUp for new users
    // or updateDoc for existing users who logged in via Google but have missing data
    if (!user || !userData) return;
    setIsRegistering(true);
    isSubmittingRegistration.current = true;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        phone: registrationData.phone,
        email: registrationData.email,
        displayName: `${registrationData.firstName} ${registrationData.lastName}`,
        credits: 0, 
        plan: 'trial'
      };
      await updateDoc(userRef, updateData);
      setUserData(prev => prev ? { ...prev, ...updateData } : null);
      setShowRegistration(false);
      
      await sendOTP(registrationData.email);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setIsRegistering(false);
      setTimeout(() => {
        isSubmittingRegistration.current = false;
      }, 3000);
    }
  };
  const [studioMode, setStudioMode] = useState<string | null>(null);
  const [refAsset, setRefAsset] = useState<{ data: string, mimeType: string, type: 'image' | 'video' } | null>(null);
  const [productAsset, setProductAsset] = useState<{ data: string, mimeType: string, type: 'image' } | null>(null);
  const [lipsyncAsset, setLipsyncAsset] = useState<{ data: string, mimeType: string, type: 'image' | 'video' } | null>(null);
  const [lipsyncProductAsset, setLipsyncProductAsset] = useState<{ data: string, mimeType: string, type: 'image' } | null>(null);
  const [lipsyncAudio, setLipsyncAudio] = useState<{ data: string, mimeType: string } | null>(null);
  const [lipsyncAudioPrompt, setLipsyncAudioPrompt] = useState('');
  const [audioStart, setAudioStart] = useState(0);
  const [audioEnd, setAudioEnd] = useState(30);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isDomainAuthorized, setIsDomainAuthorized] = useState(true);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  
  // --- Auto-tag Prompt based on Assets ---
  useEffect(() => {
    setPrompt(prev => {
      let result = prev;
      const actorTag = '[Personagem/Referência]';
      const productTag = '[Produto]';

      // Clean existing tags to avoid duplicates or messy formatting
      result = result.replace(actorTag, '').replace(productTag, '').trim();
      if (result.startsWith(',')) result = result.substring(1).trim();

      let prefix = '';
      if (refAsset) prefix += actorTag;
      if (productAsset) prefix += productTag;
      
      if (prefix) {
        return result ? `${prefix}, ${result}` : prefix;
      }
      return result;
    });
  }, [refAsset, productAsset]);

  useEffect(() => {
    setCreativePrompt(prev => {
      let result = prev;
      const actorTag = '[Personagem/Referência]';
      const productTag = '[Produto]';

      result = result.replace(actorTag, '').replace(productTag, '').trim();
      if (result.startsWith(',')) result = result.substring(1).trim();

      let prefix = '';
      if (creativeRefAsset) prefix += actorTag;
      if (creativeProductAsset) prefix += productTag;
      
      if (prefix) {
        return result ? `${prefix}, ${result}` : prefix;
      }
      return result;
    });
  }, [creativeRefAsset, creativeProductAsset]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refAssetInputRef = useRef<HTMLInputElement | null>(null);
  const productAssetInputRef = useRef<HTMLInputElement | null>(null);
  const lipsyncAssetInputRef = useRef<HTMLInputElement | null>(null);
  const lipsyncProductAssetInputRef = useRef<HTMLInputElement | null>(null);
  const creativeLogoInputRef = useRef<HTMLInputElement | null>(null);
  const creativeRefAssetInputRef = useRef<HTMLInputElement | null>(null);
  const creativeProductAssetInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [lowPriority, setLowPriority] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [sessionPreviews, setSessionPreviews] = useState<Record<string, string>>({});
  const [activeGenerations, setActiveGenerations] = useState<Set<string>>(new Set());
  const [diagStatus, setDiagStatus] = useState<{
    firebase: 'pending' | 'ok' | 'error',
    storage: 'pending' | 'ok' | 'error',
    gemini: 'pending' | 'ok' | 'error',
    details?: string
  } | null>(null);

  // Initialize Gemini AI
  const geminiApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');

  // Helper to get the most recent valid key
  const getActiveKey = useCallback(async () => {
    // Precedence: explicit state > platform managed > env vars
    let key = geminiApiKey;
    
    // Initial cleanup of provided key
    if (key) {
      key = key.toString().trim();
      if (key.startsWith('"') && key.endsWith('"')) key = key.substring(1, key.length - 1);
      if (key.startsWith("'") && key.endsWith("'")) key = key.substring(1, key.length - 1);
    }
    
    const isPlaceholder = (k: string) => {
      if (!k) return true;
      const upper = k.toUpperCase();
      // Most common patterns of invalid or placeholder keys
      return (
        upper.startsWith('YOUR_') || 
        upper.startsWith('TODO_') || 
        upper.includes('INSERT_HERE') || 
        upper.includes('API_KEY_HERE') ||
        upper.includes('EXAMPLE') ||
        upper.includes('DEFAULT') ||
        k.length < 20 || // Real Gemini keys are usually > 35 chars
        !k.startsWith('AIza') // ALL valid Google API keys start with AIza
      );
    };

    if (key && isPlaceholder(key)) key = '';

    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        const platformKey = await (window as any).aistudio.getApiKey?.();
        if (platformKey && platformKey.length > 5 && !platformKey.includes(' ')) {
          key = platformKey;
        }
      } catch (e) {
        console.warn("Plataforma falhou ao retornar chave:", e);
      }
    }

    if (!key || isPlaceholder(key)) {
      key = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.VITE_API_KEY || '';
    }
    
    // Final cleanup
    if (key) {
      key = key.trim();
      if (key.includes(' • ') || key.includes('...') || key.toLowerCase().includes('gemini api key')) {
        console.warn("[App] Key looks like a display name, ignoring.");
        key = '';
      }
    }

    return key;
  }, [geminiApiKey]);

  const callGeminiAPI = async (options: { 
    prompt?: string, 
    contents?: any, 
    model?: string, 
    config?: any, 
    method?: 'generateContent' | 'generateImages' | 'generateVideos' | 'getVideosOperation' | 'generateContentStream',
    operation?: any
  }) => {
    const maxRetries = 2;
    let attempt = 0;
    const { prompt, contents, model = "gemini-2.0-flash", config, method = 'generateContent' } = options;

    while (attempt < maxRetries) {
      try {
        const activeKey = await getActiveKey();
        
        // Chamada via Proxy do Servidor para evitar erros de CORS e Chave Inválida no Frontend
        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method,
            apiKey: activeKey,
            args: {
              model,
              prompt,
              contents,
              config,
              operation: options.operation
            }
          })
        });

        const responseText = await response.text();
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
          if (response.status === 413) {
            throw new Error("O arquivo enviado é muito grande. Tente uma imagem menor.");
          }
          throw new Error("O sistema está temporariamente sobrecarregado. Por favor, aguarde um instante.");
        }

        if (!response.ok) {
          // Commercial Error Masking: Prefer human message, fallback to generic
          const msg = data.message || "Estamos refinando nossos motores de IA. Tente novamente em breve.";
          throw new Error(msg);
        }

        return data;
      } catch (error: any) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error("Lumina Gemini Final Error:", error);
          throw error;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [brandStep, setBrandStep] = useState<'list' | 'upload' | 'info'>('list');

  // --- Auto-send OTP ---
  useEffect(() => {
    if (user && userData && !userData.isVerified && !lastSentCode) {
      sendOTP();
    }
  }, [user, userData?.isVerified, lastSentCode]);

  // --- Auth & Data Sync ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setView('app');
      }
      setIsAuthReady(true);
      registrationInitialized.current = false;

      if (currentUser) {
        // Cleanup previous listeners if any
        unsubUserRef.current?.();
        unsubBatchRef.current?.();

        // Sync user profile
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Listen for user data changes (credits, plan)
        unsubUserRef.current = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setUserData(data);
            
            // Check if registration is complete
            const isMissingData = !data.firstName || !data.lastName || !data.phone || !data.email;
            
            if (isMissingData) {
              if (!registrationInitialized.current) {
                setRegistrationData({
                  firstName: data.firstName || '',
                  lastName: data.lastName || '',
                  phone: data.phone || '',
                  email: data.email || currentUser.email || '',
                  password: ''
                });
                registrationInitialized.current = true;
              }
              // Only show registration if we're not currently submitting it
              if (!isSubmittingRegistration.current) {
                setShowRegistration(true);
              }
            } else {
              setShowRegistration(false);
            }
          } else {
            // New user initial shell
            const refCode = Math.random().toString(36).substring(2, 9);
            const referredBy = localStorage.getItem('referredBy') || null;
            
            const initialData = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: currentUser.email === 'luminaaisolutions@gmail.com' ? 'admin' : 'user',
              credits: 0, // No credits until registration
              plan: 'trial',
              createdAt: new Date(),
              isVerified: false,
              referralCode: refCode,
              referredBy: referredBy,
              referralCount: 0
            };
            setDoc(userRef, initialData).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`));
            setUserData(initialData as any);
            
            if (!registrationInitialized.current) {
              setRegistrationData({
                firstName: '',
                lastName: '',
                phone: '',
                email: currentUser.email || '',
                password: ''
              });
              registrationInitialized.current = true;
            }
            if (!isSubmittingRegistration.current) {
              setShowRegistration(true);
            }
            
            localStorage.removeItem('referredBy');
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`));

        // Sync batch items
        const batchQuery = query(
          collection(db, `users/${currentUser.uid}/batches`),
          orderBy('createdAt', 'desc')
        );
        
        unsubBatchRef.current = onSnapshot(batchQuery, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BatchItem));
          setBatch(items);
        }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${currentUser.uid}/batches`));

        // Sync brand profiles
        const brandsRef = collection(db, `users/${currentUser.uid}/brands`);
        unsubBrandsRef.current = onSnapshot(brandsRef, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          setBrandProfiles(items);
        }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${currentUser.uid}/brands`));
      } else {
        setBatch([]);
        setBrandProfiles([]);
        unsubUserRef.current?.();
        unsubBatchRef.current?.();
        unsubBrandsRef.current?.();
      }
    });
    return () => {
      unsubscribe();
      unsubUserRef.current?.();
      unsubBatchRef.current?.();
      unsubBrandsRef.current?.();
    };
  }, []);

  const handlePurchase = async (planName: string, credits: number, amount: number) => {
    if (!user || !userData) return;
    
    const confirm = window.confirm(`Deseja assinar o plano ${planName} por R$ ${amount}? Você será redirecionado para o Mercado Pago para pagamento seguro (PIX ou Cartão).`);
    if (!confirm) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          credits,
          amount,
          userId: user.uid,
          userEmail: userData.email || user.email
        })
      });

      if (!res.ok) throw new Error("Falha ao criar preferência de pagamento.");
      
      const { init_point } = await res.json();
      
      // Redirect to Mercado Pago
      window.location.href = init_point;
    } catch (error: any) {
      console.error("Payment error:", error);
      alert(`Erro ao processar pagamento: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("ERRO DE AUTENTICAÇÃO: Este domínio não está autorizado no seu projeto Firebase. \n\nPor favor, acesse o Console do Firebase > Authentication > Settings > Authorized Domains e adicione os domínios da sua aplicação.");
      } else {
        alert(`Erro ao entrar com Google: ${error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSessionPreviews({});
      setShowUserMenu(false);
      setView('landing');
      localStorage.removeItem('lumina_view');
      localStorage.removeItem('lumina_activeTab');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sendOTP = async (targetEmailOverride?: string) => {
    if (!user || !userData) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const targetEmail = targetEmailOverride || userData.email || user.email;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), { verificationCode: code });
      
      await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, code, userId: user.uid })
      });
      
      showNotification("Um código de verificação foi enviado para o seu e-mail.", "success");
      setLastSentCode(code);
    } catch (error) {
      console.error("Failed to send OTP:", error);
    }
  };

  const verifyOTP = async () => {
    if (!user || !userData) return;
    const enteredCode = verificationCode.join('');
    
    if (enteredCode.length < 6) {
      showNotification("Por favor, insira o código completo.", "info");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, code: enteredCode })
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha na verificação.");
      }

      showNotification("Conta verificada com sucesso! Você recebeu 40 créditos de teste.", "success");
      setView('app'); 
    } catch (error: any) {
      console.error("Verification failed:", error);
      alert(error.message);
      setVerificationCode(['', '', '', '', '', '']);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCreativeProductAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const compressedBase64 = await compressImage(file);
      setCreativeProductAsset({
        data: compressedBase64,
        mimeType: 'image/jpeg',
        type: 'image'
      });
    }
    e.target.value = '';
  };

  const handleCreativeRefAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const compressedBase64 = await compressImage(file);
        setCreativeRefAsset({
          data: compressedBase64,
          mimeType: 'image/jpeg',
          type: 'image'
        });
      } else if (file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          setCreativeRefAsset({
            data: base64String,
            mimeType: file.type,
            type: 'image' // We store internal as type 'image' for reference even if it's video
          } as any);
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleCreativeLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const logo = { data: base64, mimeType: file.type };
      setCreativeLogo(logo);
      
      if (activeBrandProfileId) {
        setBrandProfiles(prev => prev.map(b => b.id === activeBrandProfileId ? { ...b, logos: [logo] } : b));
      }
      
      analyzeLogoColors(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const analyzeLogoColors = async (base64: string, mimeType: string) => {
    setIsAnalyzingLogo(true);
    try {
      const response = await callGeminiAPI({
        model: "gemini-2.0-flash",
        contents: [
          { 
            role: "user",
            parts: [
              { text: "Analise esta logomarca e identifique as 3 cores principais em formato HEX (ex: #FF0000). Retorne APENAS os códigos HEX separados por vírgula, sem explicações." },
              { inlineData: { data: base64, mimeType } }
            ]
          }
        ]
      });
      
      const text = response.text;
      if (text) {
        const colors = text.split(',').map(c => c.trim()).filter(c => c.startsWith('#'));
        setCreativeColors(colors);
        if (activeBrandProfileId) {
          setBrandProfiles(prev => prev.map(b => b.id === activeBrandProfileId ? { ...b, colors } : b));
        }
      }
    } catch (error) {
      console.error("Logo analysis failed:", error);
    } finally {
      setIsAnalyzingLogo(false);
    }
  };

  const handleDeepBrandAnalysis = async () => {
    if (!editingBrand || isAnalyzingBrand) return;
    setIsAnalyzingBrand(true);
    
    try {
      const rawAssets = [...editingBrand.logos, ...editingBrand.images].filter(Boolean);
      const assets = rawAssets.slice(0, 4);
      
      if (assets.length === 0) {
        showNotification("Suba pelo menos um logotipo ou imagem para análise profunda.", "info");
        setIsAnalyzingBrand(false);
        return;
      }

      const parts: any[] = assets.map(asset => ({
        inlineData: { data: asset.data, mimeType: asset.mimeType }
      }));

      parts.push({
        text: `Analise profundamente a identidade visual e o branding destas imagens da empresa "${editingBrand.name}". 
        Forneça um relatório estratégico que defina o padrão desta marca baseado nestes assets.
        
        Retorne os dados EXATAMENTE no seguinte formato JSON (sem markdown ou blocos de código):
        {
          "styleAnalysis": "Breve descrição do estilo visual predominante e estética.",
          "toneOfVoice": "Como a marca deve se comunicar (tom de voz).",
          "detectedPalette": ["#hex1", "#hex2", "#hex3"],
          "typographyRecommendation": "Modern/Classic/Minimal/Bold/Elegant",
          "brandingEssence": "Resumo da essência e propósito visual da marca."
        }`
      });

      const response = await callGeminiAPI({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts }]
      });

      const text = response.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[0].trim());
          setEditingBrand(prev => ({
            ...prev!,
            styleAnalysis: data.styleAnalysis || data.brandingEssence || '',
            toneOfVoice: data.toneOfVoice || '',
            detectedPalette: data.detectedPalette || [],
            typography: data.typographyRecommendation || prev!.typography,
            colors: data.detectedPalette && data.detectedPalette.length > 0 ? data.detectedPalette : prev!.colors
          }));
        } catch (e) {
          console.error("JSON parse error in brand analysis:", e, text);
          throw new Error("A IA retornou um formato de resposta inválido. Tente novamente.");
        }
      } else {
        console.error("No JSON found in response:", text);
        throw new Error("A IA não conseguiu gerar o relatório da marca. Tente novamente.");
      }
    } catch (error: any) {
      console.error("Brand deep analysis failed:", error);
      showNotification(error.message || "Falha na análise da marca. Tente novamente.", "error");
    } finally {
      setIsAnalyzingBrand(false);
    }
  };

  const handleMagicPrompt = async () => {
    if (!prompt || isMagicLoading) return;
    setIsMagicLoading(true);
    try {
      const response = await callGeminiAPI({
        model: "gemini-2.0-flash",
        prompt: `Expanda o seguinte prompt de criação de imagem/vídeo para torná-lo profissional, detalhado e artístico. Mantenha o idioma original do prompt. Retorne APENAS o prompt expandido, sem explicações. Prompt original: "${prompt}"`
      });
      
      const text = response.text;
      if (text) setPrompt(text.trim());
    } catch (error) {
      console.error("Magic prompt failed:", error);
    } finally {
      setIsMagicLoading(false);
    }
  };

  // --- Generation Logic ---
  const getCostPerItem = (isLipsyncMode = useLipsync, isCreativeMode = useCreativeStudio) => {
    let baseCost = 1;
    let currentRes = resolution;
    let currentLowPri = lowPriority;
    
    if (isLipsyncMode) {
      baseCost = 15; // Standard LipSync cost
      currentRes = lipsyncResolution;
      currentLowPri = lipsyncLowPriority;
    } else if (isCreativeMode) {
      // Creative ADS is always 1 credit per image/ad as requested
      return 1;
    } else if (type === 'video') {
      baseCost = videoDuration >= 8 ? 35 : 20;
      currentRes = resolution;
      currentLowPri = lowPriority;
    } else {
      baseCost = 1; // Base image cost
      currentRes = resolution;
      currentLowPri = lowPriority;
    }

    // Resolution Multiplier
    const multipliers: Record<string, number> = {
      '720p': 1,
      '1080p': 1.5,
      '2K': 2.5,
      '4K': 4
    };
    
    const multiplier = multipliers[currentRes] || 1;
    let finalCost = Math.ceil(baseCost * multiplier);

    // If it's a standard image (not lipsync or video), force cost to 1 as requested
    if (!isLipsyncMode && type === 'image') {
      finalCost = 1;
    }

    // Low Priority Discount (50% off)
    if (currentLowPri) {
      finalCost = Math.ceil(finalCost * 0.5);
    }

    return finalCost;
  };

  const handleCreate = async (e: React.FormEvent, forceLipsync?: boolean, forceCreative?: boolean) => {
    e.preventDefault();
    if (!user || !userData) return;

    const isLipsyncActive = forceLipsync !== undefined ? forceLipsync : (activeTab === 'lipsync');
    const isCreativeActive = forceCreative !== undefined ? forceCreative : (activeTab === 'projects');
    
    const costPerItem = getCostPerItem(isLipsyncActive, isCreativeActive);
    let currentQuantity = isLipsyncActive ? lipsyncQuantity : quantity;
    if (isCreativeActive) currentQuantity = creativeQuantity;
    
    // Split prompts and limit to 20
    let rawPrompts = isCreativeActive ? [creativePrompt] : prompt.split('\n').filter(p => p.trim() !== '');
    
    // If no prompts and not lipsync, return. 
    // If lipsync, we can use an empty string to trigger default prompt logic.
    if (rawPrompts.length === 0 || (isCreativeActive && creativePrompt.trim() === '')) {
      if (isLipsyncActive) {
        rawPrompts = [""];
      } else if (isCreativeActive) {
        showNotification("Por favor, descreva o que deseja no criativo.", "info");
        return;
      } else {
        return;
      }
    }
    
    const finalPrompts = rawPrompts.slice(0, 20);
    const totalCost = costPerItem * currentQuantity * finalPrompts.length;

    if (rawPrompts.length > 20) {
      alert("Limite de 20 prompts atingido. Apenas os primeiros 20 serão processados.");
    }

    // Check credits
    if (userData.credits < totalCost) {
      showNotification(`Saldo insuficiente! Esta operação custa ${totalCost} créditos, mas você possui apenas ${userData.credits}.`, "error");
      setActiveTab('plans');
      return;
    }

    // Check for API key if using image models (Only in AI Studio environment)
    if (typeof window !== 'undefined' && (window as any).aistudio && (type === 'image' || type === 'video' || isLipsyncActive || isCreativeActive)) {
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio?.openSelectKey();
      }
    }

    // Validation for Lipsync
    if (isLipsyncActive && !lipsyncAsset) {
      alert("Para usar o Lip Sync, você precisa fazer o upload de um Personagem/Referência.");
      return;
    }
    if (isLipsyncActive && !lipsyncAudio && lipsyncAudioPrompt.trim() === '') {
      alert("Para usar o Lip Sync, você precisa fazer o upload de um arquivo de Áudio ou escrever um Prompt de Áudio.");
      return;
    }
    
    // Validation for Estúdio Lumina
    if (isCreativeActive && !creativeLogo) {
      showNotification("Para gerar criativos, você precisa subir a logomarca.", "info");
      return;
    }

    setIsProcessing(true);
    // Remove automatic switch to dashboard to stay in the current tab and show results
    // setActiveTab('dashboard');
    
    const currentPrompt = isCreativeActive ? creativePrompt : prompt;
    const currentType = isCreativeActive ? 'image' : type;
    const currentAspectRatio = isCreativeActive ? (
      creativeFormat.includes('9:16') ? '9:16' : 
      creativeFormat.includes('16:9') ? '16:9' : 
      creativeFormat.includes('1.91:1') ? '16:9' : // Map to closest standard
      '1:1'
    ) : (isLipsyncActive ? lipsyncAspectRatio : aspectRatio);
    const currentResolution = isLipsyncActive ? lipsyncResolution : resolution;
    const currentUseGrounding = useGrounding;
    const currentRefAsset = isCreativeActive ? creativeRefAsset : refAsset;
    const currentProductAsset = isCreativeActive ? creativeProductAsset : productAsset;
    const currentLipsyncAsset = lipsyncAsset;
    const currentLipsyncProductAsset = lipsyncProductAsset;
    const currentModelType = modelType;
    const currentStyle = selectedStyle;
    const currentLipsyncAudio = lipsyncAudio;
    const currentLipsyncAudioPrompt = lipsyncAudioPrompt;
    const currentUseLipsync = isLipsyncActive;
    const currentAudioStart = audioStart;
    const currentLowPriority = isLipsyncActive ? lipsyncLowPriority : lowPriority;
    const currentVideoDuration = isLipsyncActive ? lipsyncDuration : videoDuration;
    // Strict duration enforcement for lipsync:
    // Regardless of user selection, we only take the first X seconds of the selected range
    const currentAudioEnd = isLipsyncActive ? (currentAudioStart + currentVideoDuration) : audioEnd;
    
    // Creative Studio Capture
    const currentUseCreativeStudio = isCreativeActive;
    const currentCreativeLogo = creativeLogo;
    const currentCreativeColors = creativeColors;
    const currentCreativeTypography = creativeTypography;
    const currentCreativeFormat = creativeFormat;
    const currentCreativeQuantity = currentQuantity;
    const currentCreativePrompt = currentPrompt;
    const currentCreativeStrategy = creativeStrategy;
    const currentCreativeAesthetic = creativeAesthetic;
    const currentAdGoal = adGoal;
    const currentAdTrigger = adTrigger;
    const currentAdPlatform = adPlatform;

    // Brand Strategic Patterns
    const activeBrand = brandProfiles.find(b => b.id === activeBrandProfileId);
    const currentStyleAnalysis = activeBrand?.styleAnalysis || '';
    const currentToneOfVoice = activeBrand?.toneOfVoice || '';
    
    // Deduct credits immediately
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { credits: increment(-totalCost) }).catch(err => {
      console.error("Failed to deduct credits:", err);
    });
    
    // Clear form but DON'T stop processing
    if (!isCreativeActive) {
      setPrompt('');
      setRefAsset(null);
      setProductAsset(null);
      setLipsyncAsset(null);
      setLipsyncProductAsset(null);
      setLipsyncAudio(null);
      setLipsyncAudioPrompt('');
      setUseLipsync(false);
    } else {
      setCreativePrompt('');
      setCreativeRefAsset(null);
      setCreativeProductAsset(null);
    }
    
    setUseCreativeStudio(false);
    setIsProcessing(false); 
    
    // Track active generations globally to prevent cancellation on tab switch
    const totalItems = finalPrompts.length * currentQuantity;
    const generationIds = Array.from({ length: totalItems }).map(() => Math.random().toString(36).substr(2, 9));
    setActiveGenerations(prev => {
      const next = new Set(prev);
      generationIds.forEach(id => next.add(id));
      return next;
    });

    const generateItem = async (itemId: string, itemPrompt: string, index: number) => {
      const itemPath = `users/${user.uid}/batches/${itemId}`;

      try {
        // 1. Create pending item in Firestore
        const newItem: BatchItem = {
          id: itemId,
          type: currentUseLipsync ? 'lipsync' : currentType,
          sourceTab: currentUseLipsync ? 'lipsync' : currentUseCreativeStudio ? 'projects' : 'creative_studio',
          status: currentLowPriority ? 'pending' : 'processing',
          prompt: itemPrompt,
          aspectRatio: currentAspectRatio,
          resolution: currentResolution,
          duration: currentVideoDuration,
          progress: currentLowPriority ? 5 : 10,
          createdAt: new Date(),
          lowPriority: currentLowPriority
        };
        await setDoc(doc(db, itemPath), newItem);

        if (currentLowPriority) {
          // Simulate queue delay for low priority
          await new Promise(resolve => setTimeout(resolve, 8000));
          await updateDoc(doc(db, itemPath), { status: 'processing', progress: 10 });
        }
        
        // 2. Call Gemini API
        if (currentType === 'image' && !(currentUseLipsync && currentLipsyncAudio)) {
          // 2a. Enhance prompt for better image results
          await updateDoc(doc(db, itemPath), { progress: 20, status: 'processing' });
          
          let enhancedPrompt = itemPrompt;
          if (!fastMode) {
            try {
              const hasRef = currentRefAsset && currentRefAsset.type === 'image';
              const hasProduct = currentProductAsset && currentProductAsset.type === 'image';
              const hasCreativeLogo = currentUseCreativeStudio && currentCreativeLogo;
              
              const creativeContext = currentUseCreativeStudio ? `
              [ADS MODE ACTIVE]
              
              TEXT & SPELLING:
              - ONLY include text if explicitly requested by the user.
              - If text is requested: ensure Perfect Spelling in Portuguese (BR).
              - WORD CHECK: "VIVO" (V-I-V-O). NEVER WRITE "LIVO".
              - WORD CHECK: "NEGÓCIOS" (N-E-G-Ó-C-I-O-S). 
              
              INSTRUCTIONS:
              - Depict a professional corporate scene based on user prompt.
              ` : '';

              const studioContext = activeTab === 'creative_studio' ? `
              [STUDIO MODE ACTIVE]
              
              FOCUS:
              - High-end professional portraiture/headshots.
              - Perfect skin, natural light, 8k focus.
              - ABSOLUTELY NO TEXT, LOGOS, OR BRAND NAMES unless explicitly requested in the user prompt.
              - DO NOT mention "Lumina" in the final prompt.
              ` : '';
              
              const styleContext = currentStyle ? `[STYLE: ${currentStyle}]` : '';
              
              const enhancerRes = await callGeminiAPI({
                model: 'gemini-2.0-flash',
                prompt: `You are an expert visual prompt engineer. 
                TASK: Elaborate the user's idea into a rich, descriptive prompt for high-quality image generation.
                
                USER INTENT: "${itemPrompt}"
                ${styleContext}
                ${creativeContext}
                ${studioContext}
                
                OUTPUT:
                - Return ONLY the final detailed prompt in English.
                - Focus on lighting, texture, and composition.
                - NO meta-comments or explanations.
                - CRITICAL: Never include the word "LUMINA" or "LUMINA ART" in the output unless it was in the USER INTENT.
                - CRITICAL: No watermarks, signatures, or text overlays unless explicitly requested.`
              });
              
              if (enhancerRes && enhancerRes.text) {
                enhancedPrompt = enhancerRes.text;
              }
            } catch (e) {
              console.warn("Prompt enhancement failed, using original prompt:", e);
            }
          }

          // 2b. Generate Image
          await updateDoc(doc(db, itemPath), { progress: 40, status: 'processing' });
          
          let base64Data = '';
          let mimeType = 'image/png';
          let imageAttempt = 1;
          const maxImageAttempts = 3;

          while (imageAttempt <= maxImageAttempts && !base64Data) {
            try {
              // Respect user model choice (Nano = Gemini 2.5 Flash Image, Imagen = Imagen 4.0)
              const modelName = currentModelType === 'imagen' ? 'imagen-3.0-generate-001' : 'gemini-2.0-flash-exp'; 
              const methodToUse = currentModelType === 'imagen' ? 'generateImages' : 'generateContent';
              
              let promptText = enhancedPrompt;
              
              if (currentRefAsset && currentRefAsset.type === 'image' && currentModelType === 'imagen') {
                // Imagen 3 supports image-to-image or identity reference via specific prompts
                // But for now, we just ensure the identity is requested in a natural way
                promptText = `Maintain the person's identity from the reference. ${enhancedPrompt}`;
              }

              // Final Branding & Text Guard: Force the model to NOT include any text/logos
              if (!promptText.toLowerCase().includes("text") && !promptText.toLowerCase().includes("logo")) {
                promptText += ". Absolutely no text, logos, watermarks, signatures, or brand names should be present in the final image.";
              }

              // Build contents for multimodal support (Reference Images)
              const parts: any[] = [{ text: promptText }];
              
              if (currentModelType !== 'imagen') {
                // IMPORTANT: Image generation models (Gemini 2.5 Flash Image) ONLY support image modality.
                // We must filter out video/audio assets to avoid "Audio input modality not enabled" errors.
                if (currentRefAsset && currentRefAsset.data && currentRefAsset.mimeType?.startsWith('image/')) {
                  parts.unshift({
                    inlineData: {
                      data: currentRefAsset.data,
                      mimeType: currentRefAsset.mimeType
                    }
                  });
                }
                if (currentProductAsset && currentProductAsset.data && currentProductAsset.mimeType?.startsWith('image/')) {
                  parts.unshift({
                    inlineData: {
                      data: currentProductAsset.data,
                      mimeType: currentProductAsset.mimeType
                    }
                  });
                }
              }

              const response = await callGeminiAPI({
                model: modelName, 
                method: methodToUse,
                prompt: currentModelType === 'imagen' ? promptText : undefined,
                contents: currentModelType === 'imagen' ? undefined : [{ role: 'user', parts }],
                config: currentModelType === 'imagen' ? {
                  numberOfImages: 1,
                  aspectRatio: currentAspectRatio as any,
                } : {
                  imageConfig: {
                    aspectRatio: currentAspectRatio as any,
                    imageSize: (currentResolution === '2K' || currentResolution === '4K') ? currentResolution as any : '1K'
                  }
                }
              });
              
          if (response.generatedImages?.[0]?.image?.imageBytes) {
            base64Data = response.generatedImages[0].image.imageBytes;
            mimeType = response.generatedImages[0].image.mimeType || 'image/png';
          } else if (response.candidates?.[0]?.content?.parts) {
            // Fallback for different API response shapes
            const imagePart = response.candidates[0].content.parts.find((p: any) => p.inlineData);
            if (imagePart) {
              base64Data = imagePart.inlineData.data;
              mimeType = imagePart.inlineData.mimeType || 'image/png';
            }
          }

          if (!base64Data) {
            console.error("Gemini Image Response Error - Full Data:", JSON.stringify(response).substring(0, 1000));
            const safetyNotice = response.candidates?.[0]?.finishReason === 'SAFETY' ? " (Bloqueado por filtros de segurança)" : "";
            throw new Error(`Resposta da API não conteve dados de imagem válidos${safetyNotice}.`);
          }

            } catch (e: any) {
              console.warn(`Image generation attempt ${imageAttempt} failed:`, e);
              if (imageAttempt < maxImageAttempts && !e?.message?.includes('429')) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                imageAttempt++;
              } else {
                throw e;
              }
            }
          }

          if (!base64Data) throw new Error("A IA não retornou dados de imagem. Tente um prompt diferente.");

          const localImageUrl = `data:${mimeType};base64,${base64Data}`;
          
          // INSTANT PREVIEW: Update local state and Firestore immediately
          setSessionPreviews(prev => ({ ...prev, [itemId]: localImageUrl }));
          const isTooLargeForFirestore = localImageUrl.length > 800000;
          
          await updateDoc(doc(db, itemPath), {
            status: 'completed',
            progress: 100,
            previewUrl: isTooLargeForFirestore ? '' : localImageUrl,
            isLarge: isTooLargeForFirestore,
            completedAt: new Date()
          });

          // BACKGROUND UPLOAD: Ensure persistence without blocking the UI
          (async () => {
            try {
              const storageRef = ref(storage, `users/${user.uid}/images/${itemId}.png`);
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mimeType });

              await uploadBytes(storageRef, blob, { contentType: mimeType });
              const downloadUrl = await getDownloadURL(storageRef);
              
              // Update Firestore with permanent URL
              await updateDoc(doc(db, itemPath), {
                previewUrl: downloadUrl,
                isLarge: false
              });
            } catch (uploadError) {
              console.warn("Background image upload failed:", uploadError);
            }
          })();
        } else {
          // Real Video/Lipsync Generation using Veo 3.1
          const isLipsync = currentUseLipsync;
          const activeAsset = (isLipsync && currentLipsyncAsset) ? currentLipsyncAsset : currentRefAsset;
          const activeProductAsset = isLipsync ? currentLipsyncProductAsset : currentProductAsset;
          const hasImageRef = activeAsset && activeAsset.type === 'image';
          const hasVideoRef = activeAsset && activeAsset.type === 'video';
          const hasProductRef = activeProductAsset && activeProductAsset.type === 'image';
          const isAudioGenerated = isLipsync && currentLipsyncAudioPrompt.trim() !== '';

          await updateDoc(doc(db, itemPath), { progress: 15, status: 'processing' });

          // 1. Unified Audio Analysis & Prompt Enhancement (Saves Quota)
          let isMusic = false;
          let enhancedPrompt = itemPrompt;
          
          let detectedLanguage = "the audio's original language";
          // Only perform audio analysis if we have audio AND it's a model that supports it (Gemini 1.5 Flash supports audio)
          if (!fastMode && isLipsync && currentLipsyncAudio && currentLipsyncAudio.mimeType?.startsWith('audio/')) {
            try {
              const analysisRes = await callGeminiAPI({
                model: 'gemini-2.0-flash',
                contents: [{
                  role: 'user',
                  parts: [
                    { text: `Advanced Multi-Modal Audio-to-Visual Intelligence.
                    Analyze this audio and output a MASTER-CLASS VEO 3.1 PROMPT.
                    
                    USER INPUT: "${itemPrompt}"
                    
                    ANALYSIS REQUIREMENTS:
                    1. Detect if Music/vocal performance. (YES/NO)
                    2. Detect exact Language.
                    3. CREATE EXPANDED VEO 3.1 PROMPT:
                       - Visuals: Cinematic lighting, 35mm film grain, 8k, professional grading.
                       - Motion: Natural, fluid, realistic weight.
                       - Detail: Hyper-realistic skin, micro-expressions, sharp focus.
                    
                    Respond ONLY in exact JSON: { "isMusic": boolean, "language": "string", "enhancedPrompt": "string" }` },
                    { inlineData: { data: currentLipsyncAudio.data, mimeType: currentLipsyncAudio.mimeType } }
                  ]
                }],
                config: { responseMimeType: "application/json" }
              });
              
              const analysis = JSON.parse(analysisRes.text || "{}");
              isMusic = analysis.isMusic || false;
              detectedLanguage = analysis.language || detectedLanguage;
              enhancedPrompt = analysis.enhancedPrompt || itemPrompt;
            } catch (e) {
              console.warn("Unified analysis failed:", e);
            }
          } else if (isAudioGenerated) {
            detectedLanguage = "the requested prompt language";
          }

          // Force strict instructions for lipsync (Always applied)
          if (isLipsync) {
            // Simplify prompt for better adherence and less hallucination
            enhancedPrompt = `[MODE: ULTRA-PRO LIPSYNC - VEO 3.1]
            CONTENT: The character MUST speak EXACTLY: "${currentLipsyncAudioPrompt || 'Bom dia'}".
            LANGUAGE: Portuguese (PT-BR). STRICT ADHERENCE.
            VISUALS: 100% IDENTITY FIDELITY. Subject in focus, cinematic lighting, f/1.8 aperture, 8k resolution, shot on 35mm film.
            FACE: Perfect lip movements, micro-expressions synced to audio, natural blinking.
            THE PERSON MUST BE EXACTLY THE SAME AS IN THE REFERENCE IMAGE.
            ${hasProductRef ? 'PRODUCT: High-fidelity presentation of the product from reference image.' : ''}
            SYNC: Perfect time-aligned mouth synchronization.
            LIMITS: NO hallucinating text. NO excessive body movement. Professional camera work.`;
          } else if (hasProductRef) {
            enhancedPrompt = `[MODE: PROFESSIONAL PRODUCT ADS]
            CONCEPT: ${itemPrompt}
            LIGHTING: Dynamic product lighting, volumetric shadows, ray-traced reflections.
            IDENTITY: 100% same person as reference.
            PRODUCT: 100% same product as reference. High quality textures.
            CINEMATOGRAPHY: Smooth tracking shot, master-class composition, 8k.`;
          } else if (!fastMode) {
            // Apply a base level of quality expansion even for standard video
            enhancedPrompt = `[VEO 3.1 CINEMATIC MASTERPIECE]
            ACTION: ${enhancedPrompt}
            QUALITY: Cinematic lighting, 8k resolution, realistic physics, fluid motion, professional color grading, ultra-sharp focus.`;
          }

          await updateDoc(doc(db, itemPath), { progress: 30, status: 'processing' });

          // 3. Generate Video
          // Use current state-of-the-art models recommended in documentation
          const isLipsyncJob = currentUseLipsync;
          const modelToUse = isLipsyncJob ? 'veo-2.0-generate-001' : 'veo-2.0-generate-001';
          
          const activeKey = await getActiveKey();

          const isHighRes = currentResolution === '1080p' || currentResolution === '2K' || currentResolution === '4K';
          const finalResolution = isHighRes ? '1080p' : '720p';
          // Veo 3.1 1080p requires exactly 8 seconds. 720p can be 4 or 8.
          // We force 8s for 1080p to satisfy API constraints regardless of user selection.
          const finalDuration = isHighRes ? 8 : (currentVideoDuration === 8 ? 8 : 4);

          const videoParams: any = {
            model: modelToUse,
            prompt: enhancedPrompt,
            config: {
              numberOfVideos: 1,
              resolution: finalResolution,
              aspectRatio: currentAspectRatio === '1:1' ? '1:1' : (currentAspectRatio === '16:9' ? '16:9' : '9:16'),
              durationSeconds: finalDuration
            }
          };

          if (hasProductRef) {
            // Use multiple references
            const referenceImages: any[] = [];
            if (hasImageRef) {
              referenceImages.push({
                image: {
                  imageBytes: activeAsset.data,
                  mimeType: activeAsset.mimeType
                },
                referenceType: 'ASSET'
              });
            }
            if (hasProductRef) {
              referenceImages.push({
                image: {
                  imageBytes: activeProductAsset.data,
                  mimeType: activeProductAsset.mimeType
                },
                referenceType: 'ASSET'
              });
            }
// referenceImages not supported by veo-2.0, use top-level image instead
if (referenceImages.length > 0) {
  videoParams.image = {
    imageBytes: referenceImages[0].image.imageBytes,
    mimeType: referenceImages[0].image.mimeType
  };
}
          } else {
            // Use single top-level image (Lite model)
            if (hasImageRef) {
              videoParams.image = {
                imageBytes: activeAsset.data,
                mimeType: activeAsset.mimeType
              };
            }
          }

          if (isLipsyncJob) {
            if (isAudioGenerated) {
              videoParams.audio_input = {
                prompt: currentLipsyncAudioPrompt
              };
            } else if (currentLipsyncAudio) {
              videoParams.audio_input = {
                audio: {
                  audioBytes: currentLipsyncAudio.data,
                  mimeType: currentLipsyncAudio.mimeType
                }
              };
            }
          }

          // Use server-side proxy for video generation
          const videoGenRes = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'generateVideos',
              apiKey: activeKey,
              args: {
                model: modelToUse,
                prompt: videoParams.prompt,
                config: {
                  ...videoParams.config,
                  numberOfVideos: 1
                },
                image: videoParams.image,
                audio_input: videoParams.audio_input
              }
            })
          });

          const videoGenText = await videoGenRes.text();
          let videoGenData;
          try {
            videoGenData = videoGenText ? JSON.parse(videoGenText) : {};
          } catch (e) {
            throw new Error(`Resposta do servidor malformada ao iniciar geração: ${videoGenText.substring(0, 100)}...`);
          }

          if (!videoGenRes.ok) {
            throw new Error(videoGenData.error || videoGenData.message || "Erro na geração do vídeo.");
          }

          let operation = videoGenData;

          // 3. Polling
          let pollCount = 0;
          while (!operation.done) {
            pollCount++;
            const pollProgress = Math.min(30 + (pollCount * 10), 90);
            await updateDoc(doc(db, itemPath), { progress: pollProgress });
            
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const pollRes = await fetch('/api/gemini', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                method: 'getVideosOperation',
                apiKey: activeKey,
                args: { operation }
              })
            });

            const pollText = await pollRes.text();
            let pollData;
            try {
              pollData = pollText ? JSON.parse(pollText) : {};
            } catch (e) {
              // On poll failure, don't crash the whole thing immediately, maybe it's a transient network error
              console.error("Poll parse error:", pollText);
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue; 
            }

            if (!pollRes.ok) {
              throw new Error(pollData.error || pollData.message || "Erro ao verificar status do vídeo.");
            }

            operation = pollData;
          }

          if (operation.error) {
            throw new Error(String(operation.error.message || "Erro na geração do vídeo."));
          }

          // 4. Handle result
          console.log("Video Operation Result:", operation);
          
          // Try multiple possible paths for the video URI to be as robust as possible
          const videoUri = 
            operation.response?.generatedVideos?.[0]?.video?.uri || 
            operation.response?.generated_videos?.[0]?.video?.uri ||
            operation.response?.video?.uri ||
            operation.response?.video_uri;

          if (videoUri) {
            await updateDoc(doc(db, itemPath), { progress: 95 });
            
            try {
              // Fetch via proxy to avoid exposing API key and bypass CORS if needed
              const videoRes = await fetch(`/api/proxy-video?url=${encodeURIComponent(videoUri)}`);
              if (!videoRes.ok) throw new Error(`Falha ao baixar vídeo: ${videoRes.statusText}`);
              
              const videoBlob = await videoRes.blob();
              const localUrl = URL.createObjectURL(videoBlob);
              
              // INSTANT PREVIEW: Update UI immediately with local blob URL
              setSessionPreviews(prev => ({ ...prev, [itemId]: localUrl }));
              await updateDoc(doc(db, itemPath), {
                status: 'completed',
                progress: 100,
                previewUrl: '', // Don't save blob URLs to Firestore
                completedAt: new Date()
              });

              // BACKGROUND UPLOAD: Don't block the user
              (async () => {
                try {
                  const storageRef = ref(storage, `users/${user.uid}/videos/${itemId}.mp4`);
                  await uploadBytes(storageRef, videoBlob);
                  const downloadUrl = await getDownloadURL(storageRef);
                  await updateDoc(doc(db, itemPath), { previewUrl: downloadUrl });
                } catch (bgError) {
                  console.error("Background upload failed:", bgError);
                }
              })();

            } catch (mediaError: any) {
              console.error("Erro ao processar mídia final:", mediaError);
              await updateDoc(doc(db, itemPath), {
                status: 'completed',
                progress: 100,
                previewUrl: videoUri,
                error: `Aviso: O vídeo foi gerado mas o salvamento permanente falhou (${mediaError.message}).`
              });
            }
          } else {
            throw new Error("O motor Veo não retornou um vídeo válido.");
          }

          setActiveGenerations(prev => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
        
        // Remove from active generations on success
        if (currentType === 'image' && !(currentUseLipsync && currentLipsyncAudio)) {
          setActiveGenerations(prev => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
      } catch (error: any) {
        console.error(`Generation ${index} failed:`, error);
        let errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = "Limite de cota atingido (Erro 429). A API do Google está sobrecarregada ou você atingiu o limite de gerações por minuto. Aguarde 60 segundos e tente novamente.";
        } else if (error?.message?.includes('403') || error?.message?.includes('Requested entity was not found') || error?.message?.includes('PERMISSION_DENIED')) {
          errorMessage = "Erro de Permissão (403). Verifique sua chave de API.";
        }

        await updateDoc(doc(db, itemPath), {
          status: 'failed',
          error: errorMessage
        });

        // REFUND CREDITS ON FAILURE
        try {
          const userRef = doc(db, 'users', user.uid);
          // Note: costPerItem is available in the parent scope of generateItem
          await updateDoc(userRef, { credits: increment(costPerItem) });
          console.log(`Refunded ${costPerItem} credits for failed item ${itemId}`);
        } catch (refundError) {
          console.error("Failed to refund credits:", refundError);
        }
        
        setActiveGenerations(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    };

    // Execute all generations with prompt expansion for diversity
    const executeGenerations = async () => {
      for (let pIndex = 0; pIndex < finalPrompts.length; pIndex++) {
        const itemPrompt = finalPrompts[pIndex];
        let expandedPrompts = Array(currentQuantity).fill(itemPrompt);

        // If quantity > 1, expand the prompt to ensure diversity as requested by the user
        if (currentQuantity > 1 && currentType === 'image' && !fastMode) {
          try {
            const expansionRes = await callGeminiAPI({
              model: 'gemini-2.0-flash',
              prompt: `The user wants ${currentQuantity} diverse and high-quality images based on this theme: "${itemPrompt}".
              Generate ${currentQuantity} distinct, highly detailed, and unique prompt variations. 
              Each variation MUST explore a completely different aspect, location, lighting, or artistic style related to the theme to avoid repetitive results.
              The variations should have NO visual connection to each other besides the core theme.
              Output ONLY a JSON array of strings. No other text.`
            });
            
            if (expansionRes && expansionRes.text) {
              const cleaned = expansionRes.text.replace(/```json|```/g, '').trim();
              const parsed = JSON.parse(cleaned);
              if (Array.isArray(parsed) && parsed.length >= currentQuantity) {
                expandedPrompts = parsed.slice(0, currentQuantity);
              }
            }
          } catch (e) {
            console.warn("Prompt expansion failed, falling back to original prompt:", e);
          }
        }

        // Execute with concurrency control to avoid API saturation and timeouts
        const tasks = expandedPrompts.map((p, i) => ({
          p,
          i,
          itemId: generationIds[pIndex * currentQuantity + i]
        }));

        const concurrencyLimit = 3;
        let taskIdx = 0;

        const processQueue = async () => {
          if (taskIdx >= tasks.length) return;
          
          const task = tasks[taskIdx++];
          await generateItem(task.itemId, task.p, task.i);
          processQueue();
        };

        for (let i = 0; i < Math.min(concurrencyLimit, tasks.length); i++) {
          processQueue();
        }
      }
    };

    executeGenerations();
  };

  const handleDelete = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/batches/${itemId}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/batches/${itemId}`);
    }
  };

  const handleDownload = async (url: string, id: string) => {
    try {
      // Use proxy to avoid CORS issues if it's an external URL
      // If the URL is already a data: or blob:, use it directly
      const downloadUrl = (url.startsWith('blob:') || url.startsWith('data:')) ? url : `/api/proxy-download?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Falha ao baixar arquivo via proxy");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const extension = blob.type.includes('video') ? 'mp4' : 'png';
      link.download = `lumina-${id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error("Download failed, opening in new tab:", error);
      // Fallback: open in new tab
      const win = window.open(url, '_blank');
      if (win) win.focus();
    }
  };

  const compressImage = (file: File, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        };
      };
    });
  };

  const handleRefAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const compressedBase64 = await compressImage(file);
        setRefAsset({
          data: compressedBase64,
          mimeType: 'image/jpeg',
          type: 'image'
        });
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          setRefAsset({
            data: base64String,
            mimeType: file.type,
            type: 'video'
          });
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleLipsyncAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const compressedBase64 = await compressImage(file);
        setLipsyncAsset({
          data: compressedBase64,
          mimeType: 'image/jpeg',
          type: 'image'
        });
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          setLipsyncAsset({
            data: base64String,
            mimeType: file.type,
            type: 'video'
          });
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleProductAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const compressedBase64 = await compressImage(file);
      setProductAsset({
        data: compressedBase64,
        mimeType: 'image/jpeg',
        type: 'image'
      });
    }
    e.target.value = '';
  };

  const handleLipsyncProductAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const compressedBase64 = await compressImage(file);
      setLipsyncProductAsset({
        data: compressedBase64,
        mimeType: 'image/jpeg',
        type: 'image'
      });
    }
    e.target.value = '';
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const tempAudio = new Audio();
      tempAudio.src = URL.createObjectURL(file);
      tempAudio.onloadedmetadata = () => {
        const duration = tempAudio.duration;
        setAudioDuration(duration);
        setAudioStart(0);
        setAudioEnd(Math.min(duration, 30));
        setAudioCurrentTime(0);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          setLipsyncAudio({
            data: base64String,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      };
    }
    e.target.value = '';
  };

  const playAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.currentTime >= audioEnd || audioRef.current.currentTime < audioStart) {
      audioRef.current.currentTime = audioStart;
      setAudioCurrentTime(audioStart);
    }
    audioRef.current.play();
    setIsAudioPlaying(true);
  };

  const pauseAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsAudioPlaying(false);
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsAudioPlaying(false);
    audioRef.current.currentTime = audioStart;
    setAudioCurrentTime(audioStart);
  };

  useEffect(() => {
    if (audioRef.current && isAudioPlaying) {
      const interval = setInterval(() => {
        if (audioRef.current) {
          setAudioCurrentTime(audioRef.current.currentTime);
          if (audioRef.current.currentTime >= audioEnd) {
            audioRef.current.pause();
            setIsAudioPlaying(false);
            setAudioCurrentTime(audioStart);
          }
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isAudioPlaying, audioEnd]);

  const handleAudioStartChange = (val: number) => {
    const newStart = Math.min(val, audioEnd - 0.1);
    setAudioStart(newStart);
    if (!isAudioPlaying) {
      setAudioCurrentTime(newStart);
    }
    // Enforce 30s limit
    if (audioEnd - newStart > 30) {
      setAudioEnd(newStart + 30);
    }
  };

  const handleAudioEndChange = (val: number) => {
    const newEnd = Math.max(val, audioStart + 0.1);
    setAudioEnd(newEnd);
    // Enforce 30s limit
    if (newEnd - audioStart > 30) {
      const newStart = Math.max(0, newEnd - 30);
      setAudioStart(newStart);
    }
  };

  const analyzeAssetForPrompt = async () => {
    if (!refAsset || !refAsset.data) return;
    setIsAnalyzing(true);
    try {
      // Gemini 1.5 Flash supports multimodal (image/video/audio).
      // However, we restrict to image/video for prompt analysis to be safe.
      const isSupportedType = refAsset.mimeType?.startsWith('image/') || refAsset.mimeType?.startsWith('video/');
      if (!isSupportedType) {
        showNotification("Somente imagens ou vídeos podem ser analisados.", "info");
        setIsAnalyzing(false);
        return;
      }

      const response = await callGeminiAPI({
        model: "gemini-2.0-flash",
        contents: [{
          role: 'user',
          parts: [
            { text: `Describe this ${refAsset.type === 'video' ? 'video' : 'file'} in detail to be used as a high-quality video/image generation prompt. Focus on style, lighting, colors, and composition. Respond ONLY with the prompt in English.` },
            {
              inlineData: {
                data: refAsset.data,
                mimeType: refAsset.mimeType
              }
            }
          ]
        }]
      });
      
      setPrompt(response.text || "");
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const enhancePromptWithAI = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    try {
      const result = await callGeminiAPI({
        model: "gemini-2.0-flash",
        prompt: `Enhance this video/image prompt to be more cinematic, detailed, and professional: "${prompt}". 
        IMPORTANT: Use American English for the description but KEEP ANY TEXT INSIDE QUOTES EXACTLY AS IS. 
        DO NOT translate or fix spelling of text meant to be rendered inside the image (e.g. Portuguese phrases). 
        Focus on lighting, camera angles, textures, and atmosphere. Respond ONLY with the enhanced prompt in English.`
      });
      setPrompt(result.text || "");
    } catch (error) {
      console.error("Enhancement failed:", error);
      alert("Falha ao aprimorar o prompt.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const applyStyle = (style: string) => {
    const isCreative = activeTab === 'projects';
    const styles: Record<string, string> = {
      'Cinematográfico': 'cinematic lighting, 8k resolution, highly detailed, professional color grading, dramatic atmosphere',
      'Cyberpunk': 'cyberpunk aesthetic, neon lights, rainy streets, futuristic technology, high contrast, vibrant colors',
      'Realismo Extremo': 'hyper-realistic, photorealistic, extreme detail, natural lighting, 8k, sharp focus',
      'Anime': 'anime style, vibrant colors, clean lines, expressive features, studio ghibli aesthetic',
      '3D Render': 'octane render, unreal engine 5, 3d masterpiece, volumetric lighting, ray tracing',
      'Pintura': 'oil painting style, thick brushstrokes, artistic texture, canvas feel, masterpiece',
      'Vintage': 'vintage film look, 35mm, grain, nostalgic atmosphere, muted colors, classic cinematography'
    };
    
    if (styles[style]) {
      setSelectedStyle(style);
      const setTargetPrompt = isCreative ? setCreativePrompt : setPrompt;
      setTargetPrompt(prev => {
        const current = prev.trim();
        if (!current) return styles[style];
        
        // Remove existing styles to avoid stacking
        let cleanPrompt = current;
        Object.values(styles).forEach(s => {
          cleanPrompt = cleanPrompt.replace(', ' + s, '').replace(s, '');
        });
        
        return `${cleanPrompt.trim()}, ${styles[style]}`;
      });
    }
  };

  const runDiagnostics = async () => {
    setDiagStatus({ firebase: 'pending', storage: 'pending', gemini: 'pending' });
    let details = "";
    
    try {
      // 1. Test Firestore
      if (!user) throw new Error("Usuário não autenticado.");
      const testRef = doc(db, `users/${user.uid}/test/connection`);
      await setDoc(testRef, { lastTest: new Date() }, { merge: true });
      setDiagStatus(prev => ({ ...prev!, firebase: 'ok' }));
    } catch (e: any) {
      setDiagStatus(prev => ({ ...prev!, firebase: 'error' }));
      details += `Firestore: ${e.message}\n`;
    }

    try {
      // 2. Test Storage
      if (!user) throw new Error("Usuário não autenticado para teste de Storage.");
      console.log("Iniciando teste de Storage para:", user.uid);
      const storageRef = ref(storage, `users/${user.uid}/test_ping.txt`);
      
      const blob = new Blob(['ping'], { type: 'text/plain' });
      const uploadPromise = uploadBytes(storageRef, blob).then(res => {
        console.log("Upload de teste concluído:", res.metadata.fullPath);
        return res;
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout no upload (30s) - Verifique se o bucket de Storage está ativado no console Firebase.')), 30000)
      );
      
      await Promise.race([uploadPromise, timeoutPromise]);
      setDiagStatus(prev => ({ ...prev!, storage: 'ok' }));
    } catch (e: any) {
      console.error("Erro no teste de Storage:", e);
      setDiagStatus(prev => ({ ...prev!, storage: 'error' }));
      details += `Storage: ${e.message}\n`;
    }

    try {
      // 3. Test Gemini
      const response = await callGeminiAPI({
        model: "gemini-2.0-flash",
        prompt: "ping"
      });
      
      if (response.text) {
        setDiagStatus(prev => ({ ...prev!, gemini: 'ok' }));
      } else {
        throw new Error("Resposta vazia da API");
      }
    } catch (e: any) {
      console.error("Erro no teste do Gemini:", e);
      setDiagStatus(prev => ({ ...prev!, gemini: 'error' }));
      let msg = e.message;
      if (msg.includes('API key not valid') || msg.includes('not configured')) {
        msg = "Chave de API inválida ou não configurada no servidor.";
      } else if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('BLOCKED')) {
        msg = "ACESSO NEGADO: Sua chave de API do Gemini pode não ter a 'Generative Language API' ativada no Google Cloud Console ou está bloqueada.";
      } else if (msg.includes('503') || msg.includes('high demand')) {
        msg = "Servidores do Google sobrecarregados. Tente novamente em 1 minuto.";
      }
      details += `Gemini: ${msg}\n`;
    }

    if (details) {
      setDiagStatus(prev => ({ ...prev!, details }));
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (view === 'landing' || !user) {
    return (
      <>
        <LandingPage 
          isAuthenticated={!!user}
          onEnterStudio={() => setView('app')}
          onLogin={() => {
            setShowRegistration(false);
            setShowLoginModal(true);
          }} 
          onSignUp={() => {
            setShowLoginModal(false);
            setShowRegistration(true);
          }}
          onViewTerms={() => { setLegalTab('terms'); setShowTerms(true); }}
          onViewPrivacy={() => { setLegalTab('privacy'); setShowTerms(true); }}
          onViewContact={() => { setLegalTab('contact'); setShowTerms(true); }}
        />
        {showLoginModal && (
          <LoginModal 
            onLogin={handleEmailLogin}
            onGoogleLogin={handleGoogleLogin}
            onSwitchToSignUp={() => {
              setShowLoginModal(false);
              setShowRegistration(true);
            }}
            onForgotPassword={handleForgotPassword}
            isProcessing={isLoggingIn}
            isResetting={isResettingPassword}
          />
        )}
        {showRegistration && (
          <RegistrationModal 
            data={registrationData}
            onChange={(field, value) => setRegistrationData(prev => ({ ...prev, [field]: value }))}
            onSubmit={user ? handleRegister : handleEmailSignUp}
            onGoogleLogin={handleGoogleLogin}
            isProcessing={isRegistering}
            onBack={() => {
              setShowRegistration(false);
              setShowLoginModal(true);
            }}
            onViewTerms={() => setShowTerms(true)}
          />
        )}
        {showTerms && <LegalModal tab={legalTab} onClose={() => setShowTerms(false)} />}
      </>
    );
  }

  if (showRegistration) {
    return (
      <>
        <RegistrationModal 
          data={registrationData}
          onChange={(field, value) => setRegistrationData(prev => ({ ...prev, [field]: value }))}
          onSubmit={handleRegister}
          onGoogleLogin={handleGoogleLogin}
          isProcessing={isRegistering}
          onBack={() => {
            auth.signOut();
            setShowRegistration(false);
            setShowLoginModal(true);
          }}
          onViewTerms={() => setShowTerms(true)}
        />
        {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      </>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userData.isVerified) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8 text-center"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">Verifique seu email</h1>
            <p className="text-gray-400">Digite o código de 6 dígitos enviado para seu email</p>
            <div className="mt-2">
              <span className="text-[10px] text-[#d4af37] font-bold uppercase tracking-widest bg-[#d4af37]/10 py-1 px-3 rounded-full inline-block border border-[#d4af37]/20">
                Ambiente de Teste: Código disponível abaixo
              </span>
            </div>
          </div>

          <div className="bg-[#111] p-8 rounded-[32px] border border-[#222] space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Código enviado para</p>
              <p className="font-bold text-[#d4af37]">{userData?.email || user?.email}</p>
            </div>

            <div className="flex justify-center gap-2">
              {verificationCode.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9]$/.test(val) || val === '') {
                      const newCode = [...verificationCode];
                      newCode[idx] = val;
                      setVerificationCode(newCode);
                      if (val && idx < 5) {
                        (document.getElementById(`otp-${idx + 1}`) as HTMLInputElement)?.focus();
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !verificationCode[idx] && idx > 0) {
                      (document.getElementById(`otp-${idx - 1}`) as HTMLInputElement)?.focus();
                    }
                  }}
                  id={`otp-${idx}`}
                  className="w-12 h-16 bg-[#1a1a1a] border border-[#222] rounded-xl text-center text-2xl font-black focus:border-[#d4af37] focus:outline-none transition-all"
                />
              ))}
            </div>

            <div className="space-y-4 pt-4">
              {(lastSentCode || userData?.verificationCode) && (
                <div className="bg-[#d4af37] p-4 rounded-2xl text-center shadow-lg shadow-[#d4af37]/20 animate-pulse">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1">CÓDIGO DE ACESSO (TESTE)</p>
                  <p className="text-3xl font-black text-black tracking-[0.3em]">{lastSentCode || userData?.verificationCode}</p>
                </div>
              )}
              
              <button 
                onClick={verifyOTP}
                disabled={isVerifying || verificationCode.some(d => !d)}
                className="w-full py-4 bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black rounded-2xl hover:scale-105 transition-all disabled:opacity-50"
              >
                {isVerifying ? 'VERIFICANDO...' : 'VERIFICAR CÓDIGO'}
              </button>
              
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => sendOTP()}
                  className="text-xs font-bold text-gray-400 hover:text-[#d4af37] transition-colors flex items-center justify-center gap-2"
                >
                  <Clock size={14} />
                  Não recebeu o código? Reenviar código
                </button>
                <button 
                  onClick={handleLogout}
                  className="text-xs font-bold text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowRight size={14} className="rotate-180" />
                  Usar outro email
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#111] py-3 px-6 rounded-full border border-[#222] inline-flex items-center gap-2 text-[10px] text-gray-500">
            <ShieldCheck size={14} className="text-[#d4af37]" />
            O código expira em 10 minutos. Verifique também sua pasta de spam.
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans selection:bg-[#d4af37] selection:text-black">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification.message && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${
              notification.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' :
              notification.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' :
              'bg-[#1a1a1a]/90 border-[#333] text-gray-300'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : 
             notification.type === 'error' ? <AlertCircle size={18} /> : 
             <Sparkles size={18} />}
            <span className="text-xs font-bold uppercase tracking-widest leading-none">{notification.message}</span>
            <button onClick={() => setNotification({ message: '', type: null })} className="ml-2 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* --- Top Navigation --- */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#111] border-b border-[#222] z-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setView('landing')}
            className="flex items-center gap-3 group hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-[#d4af37] to-[#f1c40f] rounded-xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20 group-hover:shadow-[#d4af37]/40 transition-all">
              <Zap className="text-black w-6 h-6" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="font-black text-sm tracking-tighter text-white uppercase">LUMINA</span>
              <span className="font-black text-[10px] tracking-widest text-[#d4af37] uppercase">ART CREATOR</span>
            </div>
          </button>

          <nav className="flex items-center gap-2">
            <button 
              onClick={() => setView('landing')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap font-bold text-xs uppercase tracking-widest hover:bg-[#222] text-gray-400 group"
              title="Voltar para a Landing Page"
            >
              <Home size={16} className="group-hover:text-[#d4af37] transition-colors" />
              <span className="hidden xl:block">Home</span>
            </button>
            <div className="w-px h-6 bg-[#222] mx-2" />
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'branding', label: 'Minhas Marcas', icon: Palette },
              { id: 'projects', label: 'Projetos Criativos Ads', icon: Briefcase },
              { id: 'creative_studio', label: 'Estúdio Lumina', icon: Sparkles },
              { id: 'lipsync', label: 'Lip Sync', icon: Mic },
              { id: 'library', label: 'Biblioteca', icon: Library },
              { id: 'plans', label: 'Planos', icon: ShoppingBag },
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'projects') { setUseCreativeStudio(true); setUseLipsync(false); }
                  if (tab.id === 'creative_studio') { setUseCreativeStudio(false); setUseLipsync(false); }
                  if (tab.id === 'lipsync') { setUseCreativeStudio(false); setUseLipsync(true); }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap font-bold text-xs uppercase tracking-widest ${activeTab === tab.id ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'hover:bg-[#222] text-gray-400'}`}
              >
                <tab.icon size={16} />
                <span className="hidden xl:block">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6 relative">
          {userData && (
            <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-2xl">
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-[#d4af37] uppercase tracking-widest leading-none mb-1">Créditos</span>
                <span className="text-base font-black text-white leading-none">{userData.credits || 0}</span>
              </div>
              <div className="w-px h-6 bg-[#222]" />
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Plano</span>
                <span className="text-sm font-bold text-white leading-none uppercase">{userData.plan}</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3 pl-6 border-l border-[#222] relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 group"
            >
              <div className="flex flex-col items-end hidden sm:block">
                <p className="text-xs font-bold text-white leading-none mb-1 group-hover:text-[#d4af37] transition-colors">{user.displayName}</p>
                <p className="text-[10px] text-gray-500 leading-none">{user.email}</p>
              </div>
              <div className="relative">
                <img src={user.photoURL || ''} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-800 border border-[#222] group-hover:border-[#d4af37] transition-all" referrerPolicy="no-referrer" />
                <div className="absolute -bottom-1 -right-1 bg-[#d4af37] text-black rounded-full p-0.5 border-2 border-[#111]">
                  <ChevronDown size={8} />
                </div>
              </div>
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-4 w-64 bg-[#111] border border-[#222] rounded-3xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-6 border-b border-[#222] bg-gradient-to-br from-[#1a1a1a] to-[#111]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-black text-white uppercase tracking-tighter truncate max-w-[140px]">{user.displayName}</p>
                        <span className="px-2 py-0.5 bg-[#d4af37]/10 text-[#d4af37] text-[8px] font-black rounded uppercase">BR</span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                    </div>

                    <div className="p-2">
                      <button 
                        onClick={() => { setActiveTab('plans'); setShowUserMenu(false); }}
                        className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard size={18} className="text-gray-500 group-hover:text-[#d4af37]" />
                          <span className="text-xs font-bold text-gray-300">Créditos/Mês</span>
                        </div>
                        <div className="flex items-center gap-1 bg-[#d4af37]/10 px-2 py-1 rounded-lg">
                          <Sparkles size={10} className="text-[#d4af37]" />
                          <span className="text-[10px] font-black text-[#d4af37]">{userData?.credits || 0}</span>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('profile'); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 p-4 hover:bg-[#1a1a1a] rounded-2xl transition-all group text-left"
                      >
                        <Settings size={18} className="text-gray-500 group-hover:text-[#d4af37]" />
                        <span className="text-xs font-bold text-gray-300">Perfil e Conta</span>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('referrals'); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 p-4 hover:bg-[#1a1a1a] rounded-2xl transition-all group text-left"
                      >
                        <Gift size={18} className="text-gray-500 group-hover:text-[#d4af37]" />
                        <span className="text-xs font-bold text-gray-300">Indicações</span>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('faq'); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 p-4 hover:bg-[#1a1a1a] rounded-2xl transition-all group text-left"
                      >
                        <HelpCircle size={18} className="text-gray-500 group-hover:text-[#d4af37]" />
                        <span className="text-xs font-bold text-gray-300">FAQ e Informações</span>
                      </button>

                      <div className="h-px bg-[#222] my-2 mx-4" />

                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-4 hover:bg-red-500/10 rounded-2xl transition-all group text-left"
                      >
                        <LogOut size={18} className="text-gray-500 group-hover:text-red-500" />
                        <span className="text-xs font-bold text-gray-300 group-hover:text-red-500">Sair</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="pt-24 p-4 md:p-8 min-h-screen flex flex-col">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-white">
              {activeTab === 'dashboard' && 'Painel de Controle'}
              {activeTab === 'branding' && 'Minhas Marcas'}
              {activeTab === 'projects' && 'Projetos Criativos Ads'}
              {activeTab === 'creative_studio' && 'Estúdio Lumina'}
            {activeTab === 'lipsync' && 'LipSync Studio'}
            {activeTab === 'library' && 'Sua Biblioteca'}
            {activeTab === 'plans' && 'Planos e Assinaturas'}
            {activeTab === 'profile' && 'Perfil e Conta'}
            {activeTab === 'referrals' && 'Programa de Indicações'}
            {activeTab === 'faq' && 'FAQ e Suporte'}
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            {activeTab === 'dashboard' && 'Visão geral de todas as funções principais do Lumina.'}
            {activeTab === 'branding' && 'Defina a identidade visual, cores e tipografia de seus clientes.'}
            {activeTab === 'projects' && 'Gere artes e criativos profissionais para marcas específicas.'}
            {activeTab === 'creative_studio' && 'Crie vídeos, imagens, avatares e retratos artísticos com IA.'}
            {activeTab === 'lipsync' && 'Sincronismo labial de alta fidelidade para seus vídeos.'}
            {activeTab === 'library' && 'Acesse todas as suas criações em um só lugar.'}
            {activeTab === 'plans' && 'Gerencie seus planos, créditos e configurações técnicas.'}
            {activeTab === 'profile' && 'Gerencie seus dados pessoais, segurança e informações da conta.'}
            {activeTab === 'referrals' && 'Convide amigos e ganhe créditos bônus para suas criações.'}
            {activeTab === 'faq' && 'Dúvidas frequentes, tutoriais e canais de suporte.'}
          </p>
          </div>
        </header>

        {/* --- Sub Navigation for Account Sections --- */}
        {['profile', 'referrals', 'faq'].includes(activeTab) && (
          <div className="flex items-center gap-4 mb-12 overflow-x-auto pb-2 no-scrollbar">
            {[
              { id: 'profile', label: 'Perfil e Conta', icon: User },
              { id: 'referrals', label: 'Indicações', icon: Gift },
              { id: 'faq', label: 'FAQ', icon: HelpCircle },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' 
                    : 'bg-[#111] text-gray-500 border border-[#222] hover:border-[#333]'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* --- Dashboard Tab --- */}
        {activeTab === 'dashboard' && (
          <>
            <div className="space-y-12 py-10">
            <div className="text-center space-y-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-full text-xs font-bold text-gray-400 uppercase tracking-widest"
              >
                <Sparkles size={14} className="text-[#d4af37]" />
                BEM-VINDO AO LUMINA ART CREATOR
              </motion.div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter">O QUE DESEJA <span className="text-[#d4af37]">FAZER?</span></h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto px-4">
              {[
                { 
                  id: 'branding', 
                  title: 'Minhas Marcas', 
                  desc: 'Mantenha sua marca com identidade visual consistente em todas as suas artes.', 
                  icon: Palette, 
                  btn: 'Gerenciar Marcas',
                  color: 'from-orange-500/20 to-transparent',
                  borderColor: 'hover:border-orange-500/50'
                },
                { 
                  id: 'projects', 
                  title: 'Projetos Criativos Ads', 
                  desc: 'Gere criativos organizados por projetos e campanhas de marketing.', 
                  icon: Layers, 
                  btn: 'Ver Projetos',
                  color: 'from-[#d4af37]/20 to-transparent',
                  borderColor: 'hover:border-[#d4af37]/50'
                },
                { 
                  id: 'creative_studio', 
                  title: 'Estúdio Lumina', 
                  desc: 'Crie fotos profissionais, avatares e retratos artísticos com IA.', 
                  icon: User, 
                  btn: 'Abrir Studio',
                  color: 'from-blue-500/20 to-transparent',
                  borderColor: 'hover:border-blue-500/50'
                },
                { 
                  id: 'lipsync', 
                  title: 'LipSync', 
                  desc: 'Sincronismo labial de alta fidelidade para seus vídeos e avatares.', 
                  icon: Mic, 
                  btn: 'Abrir LipSync',
                  color: 'from-pink-500/20 to-transparent',
                  borderColor: 'hover:border-pink-500/50'
                }
              ].map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`group relative bg-[#111] rounded-[40px] border border-[#222] p-6 sm:p-8 overflow-hidden transition-all ${card.borderColor} cursor-pointer`}
                  onClick={() => {
                    if (card.id === 'branding') setActiveTab('branding');
                    if (card.id === 'projects') {
                      setActiveTab('projects');
                      setUseCreativeStudio(true);
                      setUseLipsync(false);
                    }
                    if (card.id === 'creative_studio') {
                      setActiveTab('creative_studio');
                      setUseCreativeStudio(false);
                      setUseLipsync(false);
                    }
                    if (card.id === 'lipsync') {
                      setActiveTab('lipsync');
                      setUseCreativeStudio(false);
                      setUseLipsync(true);
                    }
                  }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-b ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  
                  <div className="relative z-10 space-y-6">
                    <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center border border-[#222] group-hover:border-[#d4af37]/50 transition-colors">
                      <card.icon size={32} className="text-gray-400 group-hover:text-[#d4af37] transition-colors" />
                    </div>
                    
                    <div className="space-y-2">
                      <span className="text-xs font-black text-[#d4af37] uppercase tracking-[0.2em]">{card.id}</span>
                      <h3 className="text-2xl font-bold">{card.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
                    </div>

                    <button className="w-full py-4 bg-[#1a1a1a] border border-[#222] rounded-2xl text-xs font-bold uppercase tracking-widest group-hover:bg-[#d4af37] group-hover:text-black transition-all">
                      {card.btn}
                    </button>
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <card.icon size={120} />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Recent Activity Section */}
            <div className="max-w-6xl mx-auto px-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Atividade Recente</h3>
                <button onClick={() => setActiveTab('library')} className="text-xs font-bold text-[#d4af37] uppercase tracking-widest hover:underline">Ver Tudo</button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {batch.slice(0, 5).map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="aspect-[3/4] bg-[#111] rounded-2xl border border-[#222] overflow-hidden relative group cursor-pointer"
                    onClick={() => openPreview(item, batch.slice(0, 5))}
                  >
                    {sessionPreviews[item.id] || item.previewUrl ? (
                      item.type === 'video' || item.type === 'lipsync' ? (
                        <video 
                          src={sessionPreviews[item.id] || item.previewUrl} 
                          className="w-full h-full object-cover" 
                          muted 
                          loop 
                          onMouseOver={e => e.currentTarget.play()} 
                          onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                        />
                      ) : (
                        <img src={sessionPreviews[item.id] || item.previewUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-800">
                        <ImageIcon size={32} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Ver Detalhes</span>
                    </div>
                  </motion.div>
                ))}
                {batch.length === 0 && (
                  <div className="col-span-full py-20 text-center border border-dashed border-[#222] rounded-3xl">
                    <p className="text-gray-600 text-sm">Nenhuma atividade recente encontrada.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Batch List */}
            <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
              <div className="p-6 border-b border-[#222] flex justify-between items-center">
                <h2 className="font-bold text-xl">Fila de Processamento</h2>
              </div>

              <div className="divide-y divide-[#222]">
                {batch.length === 0 ? (
                  <div className="p-20 text-center text-gray-600">
                    <Layers size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Nenhuma geração encontrada. Comece criando algo novo!</p>
                  </div>
                ) : (
                  batch.map((item) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6 flex flex-col md:flex-row gap-6 items-center hover:bg-[#151515] transition-colors"
                    >
                      <div 
                        className="w-24 h-24 rounded-xl bg-[#1a1a1a] overflow-hidden relative flex-shrink-0 group cursor-pointer"
                        onClick={() => openPreview(item, batch)}
                      >
                        {sessionPreviews[item.id] || item.previewUrl ? (
                          item.type === 'video' || item.type === 'lipsync' ? (
                            <video 
                              src={sessionPreviews[item.id] || item.previewUrl} 
                              className="w-full h-full object-cover" 
                              muted 
                              loop 
                              onMouseOver={e => e.currentTarget.play()} 
                              onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                            />
                          ) : (
                            <img 
                              src={sessionPreviews[item.id] || item.previewUrl} 
                              alt="Preview" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer" 
                            />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-700">
                            {item.type === 'video' || item.type === 'lipsync' ? <Video size={32} /> : <ImageIcon size={32} />}
                          </div>
                        )}
                        {item.status === 'processing' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {(sessionPreviews[item.id] || item.previewUrl) && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(sessionPreviews[item.id] || item.previewUrl!, item.id);
                              }} 
                              className="p-2 bg-[#d4af37]/20 text-[#d4af37] rounded-lg hover:bg-[#d4af37] hover:text-black transition-all"
                              title="Baixar Imagem"
                            >
                              <Download size={16} />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }} 
                            className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all" 
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${item.type === 'video' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                            {item.type}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">ID: {item.id}</span>
                          {item.duration && (
                            <span className="flex items-center gap-1 text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                              <Clock size={10} /> {item.duration}s
                            </span>
                          )}
                          <Timer start={item.createdAt} end={item.completedAt} status={item.status} />
                          {item.lowPriority && (
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Clock size={10} /> Low Priority
                            </span>
                          )}
                          <span className={`flex items-center gap-1 text-xs font-medium ${item.status === 'completed' ? 'text-green-400' : item.status === 'failed' ? 'text-red-400' : 'text-[#d4af37]'}`}>
                            {item.status === 'completed' ? <CheckCircle2 size={12} /> : item.status === 'failed' ? <AlertCircle size={12} /> : <Clock size={12} />}
                            {item.status === 'completed' ? 'Concluído' : item.status === 'failed' ? 'Falhou' : item.progress < 50 ? 'Gerando...' : 'Salvando...'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 line-clamp-2 mb-3">{item.prompt}</p>
                        {item.error && <p className="text-[10px] text-red-500/70 mb-2 italic">Erro: {item.error}</p>}
                        <div className="flex gap-4 text-[11px] text-gray-500 font-medium">
                          <span className="flex items-center gap-1"><Maximize2 size={10} /> {item.aspectRatio}</span>
                          <span className="flex items-center gap-1"><Zap size={10} /> {item.resolution}</span>
                        </div>
                      </div>

                      <div className="w-full md:w-48 text-right">
                        <div className="mb-2 flex justify-between text-xs font-bold">
                          <span className="text-gray-500">Progresso</span>
                          <span className="text-[#d4af37]">{Math.round(item.progress || 0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round(item.progress || 0)}%` }}
                            className={`h-full ${item.status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-[#d4af37] to-[#f1c40f]'}`}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* --- Branding Tab --- */}
        {activeTab === 'branding' && (
          <div className="w-full max-w-full mx-auto py-8 px-4 md:px-8 space-y-8">
            <div className="flex items-center gap-4 mb-8">
              {[
                { id: 'list', label: 'Minhas Marcas', icon: Briefcase },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setBrandStep(sub.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${brandStep === sub.id ? 'bg-[#d4af37] text-black' : 'bg-[#111] text-gray-500 border border-[#222] hover:border-[#333]'}`}
                >
                  <sub.icon size={16} />
                  {sub.label}
                </button>
              ))}
            </div>

            {brandStep === 'list' && (
              <>
                {/* Brand Control Box */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] p-8 rounded-[40px] border border-[#222] flex flex-wrap items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#d4af37]/10 rounded-2xl flex items-center justify-center border border-[#d4af37]/20">
                  <Palette size={28} className="text-[#d4af37]" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Minhas Marcas</h2>
                  <p className="text-gray-500 text-sm">Gerencie a identidade visual e informações de seus clientes.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Marcas Ativas</span>
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                      {brandProfiles.slice(0, 5).map((brand, i) => (
                        <div key={brand.id} className="w-10 h-10 rounded-full border-2 border-[#111] bg-[#1a1a1a] overflow-hidden flex items-center justify-center shadow-lg">
                          {brand.logos && brand.logos.length > 0 ? (
                            <img src={`data:${brand.logos[0].mimeType};base64,${brand.logos[0].data}`} className="w-full h-full object-contain p-1.5" />
                          ) : (
                            <span className="text-[10px] font-bold text-gray-500">{brand.name.charAt(0)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="relative">
                      <select 
                        value={activeBrandProfileId || ''}
                        onChange={(e) => {
                          const brandId = e.target.value;
                          if (brandId) {
                            const brand = brandProfiles.find(b => b.id === brandId);
                            if (brand) {
                              setActiveBrandProfileId(brand.id);
                              if (brand.logos && brand.logos.length > 0) {
                                setCreativeLogo(brand.logos[0]);
                              }
                              setCreativeColors(brand.colors || []);
                              setCreativeTypography(brand.typography || 'Modern');
                            }
                          }
                        }}
                        className="bg-[#1a1a1a] border border-[#222] rounded-xl px-4 py-2 text-[10px] font-bold text-gray-300 focus:outline-none focus:border-[#d4af37] appearance-none pr-8 cursor-pointer"
                      >
                        <option value="">Seletor Rápido...</option>
                        {brandProfiles.map(brand => (
                          <option key={brand.id} value={brand.id}>{brand.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="h-10 w-[1px] bg-[#222] hidden md:block" />

                <button 
                  onClick={() => {
                    setEditingBrand({
                      id: Math.random().toString(36).substr(2, 9),
                      name: '',
                      logos: [],
                      images: [],
                      colors: [],
                      typography: 'Modern',
                      mission: '',
                      niche: '',
                      contact: '',
                      description: '',
                      styleAnalysis: '',
                      toneOfVoice: '',
                      detectedPalette: []
                    });
                    setBrandStep('upload');
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black rounded-2xl text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-xl shadow-[#d4af37]/10"
                >
                  <Plus size={18} />
                  Nova Marca
                </button>
              </div>
            </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Add New Brand Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#111] p-8 rounded-[40px] border border-dashed border-[#222] flex flex-col items-center justify-center gap-4 hover:border-[#d4af37]/50 transition-all cursor-pointer group"
                  onClick={() => {
                    setEditingBrand({
                      id: Math.random().toString(36).substr(2, 9),
                      name: '',
                      logos: [],
                      images: [],
                      colors: [],
                      typography: 'Modern',
                      mission: '',
                      niche: '',
                      contact: '',
                      description: '',
                      styleAnalysis: '',
                      toneOfVoice: '',
                      detectedPalette: []
                    });
                    setBrandStep('upload');
                  }}
                >
                  <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center group-hover:bg-[#d4af37] group-hover:text-black transition-all">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg text-white">Nova Marca</h3>
                    <p className="text-gray-500 text-xs">Adicione uma nova marca</p>
                  </div>
                </motion.div>

                {brandProfiles.map((brand, i) => (
                  <motion.div
                    key={brand.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`bg-[#111] p-8 rounded-[40px] border transition-all relative group ${activeBrandProfileId === brand.id ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/10' : 'border-[#222]'}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl border border-[#222] overflow-hidden flex items-center justify-center">
                        {brand.logos && brand.logos.length > 0 ? (
                          <img src={`data:${brand.logos[0].mimeType};base64,${brand.logos[0].data}`} alt={brand.name} className="w-full h-full object-contain p-2" />
                        ) : (
                          <Palette size={24} className="text-gray-600" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setActiveBrandProfileId(brand.id);
                            if (brand.logos && brand.logos.length > 0) {
                              setCreativeLogo(brand.logos[0]);
                            }
                            setCreativeColors(brand.colors || []);
                            setCreativeTypography(brand.typography || 'Modern');
                          }}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeBrandProfileId === brand.id ? 'bg-[#d4af37] text-black' : 'bg-[#1a1a1a] text-gray-500 border border-[#222]'}`}
                        >
                          {activeBrandProfileId === brand.id ? 'Ativo' : 'Ativar'}
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm('Tem certeza que deseja excluir esta marca?')) {
                              if (user) {
                                await deleteDoc(doc(db, `users/${user.uid}/brands`, brand.id)).catch(console.error);
                              }
                            }
                          }}
                          className="p-2 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-xl text-white">{brand.name}</h3>
                        <p className="text-gray-500 text-xs uppercase tracking-widest font-bold mt-1">{brand.typography}</p>
                      </div>

                      <div className="flex gap-2">
                        {brand.colors.map((color, idx) => (
                          <div key={idx} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: color }} />
                        ))}
                        {brand.colors.length === 0 && <div className="text-[10px] text-gray-600 italic">Nenhuma cor detectada</div>}
                      </div>

                      {(brand.styleAnalysis || brand.toneOfVoice) && (
                        <div className="pt-4 border-t border-[#222] space-y-3">
                          {brand.styleAnalysis && (
                            <div className="space-y-1">
                              <span className="text-[8px] font-bold text-gray-600 uppercase">Estilo</span>
                              <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{brand.styleAnalysis}</p>
                            </div>
                          )}
                          {brand.toneOfVoice && (
                            <div className="space-y-1">
                              <span className="text-[8px] font-bold text-gray-600 uppercase">Tom de Voz</span>
                              <p className="text-[10px] text-gray-400 line-clamp-1 leading-relaxed">{brand.toneOfVoice}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Edit Overlay */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[40px]">
                      <button 
                        onClick={() => {
                          setEditingBrand(brand);
                          setBrandStep('upload');
                        }}
                        className="px-6 py-3 bg-[#d4af37] text-black font-black rounded-2xl text-xs uppercase tracking-widest hover:scale-105 transition-all"
                      >
                        Editar Marca
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

            {brandStep === 'upload' && editingBrand && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-4xl mx-auto bg-[#111] p-10 rounded-[40px] border border-[#222]"
              >
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Upload de Ativos</h2>
                    <p className="text-gray-500 text-sm">Suba os logotipos e imagens da empresa.</p>
                  </div>
                  <button onClick={() => setBrandStep('list')} className="p-2 text-gray-500 hover:text-white">
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* Logo Upload */}
                  <div className="space-y-4">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Logotipos (Até 2)</label>
                    <div className="grid grid-cols-2 gap-4">
                      {[0, 1].map((idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = async (event: any) => {
                                  const rawBase64 = event.target.result.split(',')[1];
                                  const base64 = await resizeImage(rawBase64, 600, 600); // Aggressive compression for logos
                                  const newLogos = [...editingBrand.logos];
                                  newLogos[idx] = { data: base64, mimeType: file.type };
                                  setEditingBrand({ ...editingBrand, logos: newLogos });
                                };
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                          className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden ${editingBrand.logos[idx] ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] bg-[#1a1a1a] hover:border-[#333] cursor-pointer'}`}
                        >
                          {editingBrand.logos[idx] ? (
                            <>
                              <img src={`data:${editingBrand.logos[idx].mimeType};base64,${editingBrand.logos[idx].data}`} className="w-full h-full object-contain p-4" />
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newLogos = [...editingBrand.logos];
                                  newLogos.splice(idx, 1);
                                  setEditingBrand({ ...editingBrand, logos: newLogos });
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:scale-110 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <ImagePlus size={24} className="text-gray-600" />
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Logo {idx + 1}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Images Upload */}
                  <div className="space-y-4">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Imagens da Empresa (Até 5)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2, 3, 4].map((idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = async (event: any) => {
                                  const rawBase64 = event.target.result.split(',')[1];
                                  const base64 = await resizeImage(rawBase64, 800, 800); // Aggressive compression for brand images
                                  const newImages = [...editingBrand.images];
                                  newImages[idx] = { data: base64, mimeType: file.type };
                                  setEditingBrand({ ...editingBrand, images: newImages });
                                };
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                          className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden ${editingBrand.images[idx] ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] bg-[#1a1a1a] hover:border-[#333] cursor-pointer'}`}
                        >
                          {editingBrand.images[idx] ? (
                            <>
                              <img src={`data:${editingBrand.images[idx].mimeType};base64,${editingBrand.images[idx].data}`} className="w-full h-full object-cover" />
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newImages = [...editingBrand.images];
                                  newImages.splice(idx, 1);
                                  setEditingBrand({ ...editingBrand, images: newImages });
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:scale-110 transition-all"
                              >
                                <Trash2 size={10} />
                              </button>
                            </>
                          ) : (
                            <>
                              <ImageIcon size={16} className="text-gray-600" />
                              <span className="text-[8px] font-bold text-gray-500 uppercase">Img {idx + 1}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {editingBrand.styleAnalysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-3xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Zap size={80} className="text-[#d4af37]" />
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-[#d4af37] text-black rounded-lg flex items-center justify-center">
                        <Zap size={14} fill="currentColor" />
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-tighter">Relatório Estratégico IA</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                      <div className="space-y-2">
                        <span className="text-xs font-black text-[#d4af37] uppercase tracking-widest block">Estética & Padrões</span>
                        <p className="text-xs text-gray-300 leading-relaxed font-medium">{editingBrand.styleAnalysis}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-black text-[#d4af37] uppercase tracking-widest block">Personalidade da Marca</span>
                        <p className="text-xs text-gray-300 leading-relaxed font-medium">{editingBrand.toneOfVoice}</p>
                      </div>
                    </div>
                    {editingBrand.colors && editingBrand.colors.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#d4af37]/10">
                        <span className="text-xs font-black text-[#d4af37] uppercase tracking-widest block mb-2">Paleta Identificada</span>
                        <div className="flex gap-2">
                          {editingBrand.colors.map((color, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                              <span className="text-[9px] font-mono text-gray-400 uppercase">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="mt-10 flex justify-end gap-4">
                  <button 
                    onClick={handleDeepBrandAnalysis}
                    disabled={isAnalyzingBrand || (editingBrand.logos.length === 0 && editingBrand.images.length === 0)}
                    className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isAnalyzingBrand ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ANALISANDO ESTILO...
                      </>
                    ) : (
                      <>
                        <Zap size={18} className="text-[#d4af37]" />
                        ANÁLISE PROFUNDA IA
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setBrandStep('info')}
                    disabled={editingBrand.logos.length === 0 && editingBrand.images.length === 0}
                    className="px-10 py-4 bg-[#d4af37] text-black font-black rounded-2xl hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    PRÓXIMO PASSO
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>
              </motion.div>
            )}

            {brandStep === 'info' && editingBrand && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-4xl mx-auto bg-[#111] p-10 rounded-[40px] border border-[#222]"
              >
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Informações da Marca</h2>
                    <p className="text-gray-500 text-sm">Preencha os detalhes estratégicos da empresa.</p>
                  </div>
                  <button onClick={() => setBrandStep('upload')} className="p-2 text-gray-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase">
                    <Clock size={16} className="rotate-180" />
                    Voltar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome da Empresa</label>
                    <input 
                      type="text" 
                      value={editingBrand.name}
                      onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-sm focus:outline-none focus:border-[#d4af37] transition-all"
                      placeholder="Ex: Lumina Solutions"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Nicho / Setor</label>
                    <input 
                      type="text" 
                      value={editingBrand.niche}
                      onChange={(e) => setEditingBrand({ ...editingBrand, niche: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-sm focus:outline-none focus:border-[#d4af37] transition-all"
                      placeholder="Ex: Tecnologia, Moda, Alimentação"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Missão da Empresa</label>
                    <textarea 
                      value={editingBrand.mission}
                      onChange={(e) => setEditingBrand({ ...editingBrand, mission: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-sm focus:outline-none focus:border-[#d4af37] transition-all min-h-[80px] resize-none"
                      placeholder="Qual o propósito da sua marca?"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Dados Básicos / Descrição</label>
                    <textarea 
                      value={editingBrand.description}
                      onChange={(e) => setEditingBrand({ ...editingBrand, description: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-sm focus:outline-none focus:border-[#d4af37] transition-all min-h-[80px] resize-none"
                      placeholder="História curta ou dados relevantes..."
                    />
                  </div>
                  <div className="space-y-4 md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Paleta de Cores Institucional</label>
                    <div className="flex gap-3 flex-wrap">
                      {editingBrand.colors.map((color, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#222] px-3 py-2 rounded-2xl group transition-all hover:border-[#d4af37]/30">
                          <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                          <input 
                            type="text" 
                            value={color} 
                            onChange={(e) => {
                              const newColors = [...editingBrand.colors];
                              newColors[idx] = e.target.value;
                              setEditingBrand({ ...editingBrand, colors: newColors });
                            }}
                            className="bg-transparent text-[11px] font-mono text-gray-400 w-20 focus:outline-none uppercase"
                          />
                          <button 
                            onClick={() => {
                              const newColors = editingBrand.colors.filter((_, i) => i !== idx);
                              setEditingBrand({ ...editingBrand, colors: newColors });
                            }}
                            className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => setEditingBrand({ ...editingBrand, colors: [...editingBrand.colors, '#d4af37'] })}
                        className="h-10 px-4 rounded-2xl border-2 border-dashed border-[#222] flex items-center justify-center gap-2 text-gray-600 hover:border-[#d4af37] hover:text-[#d4af37] transition-all"
                      >
                        <Plus size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Nova Cor</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Contato / Redes Sociais</label>
                    <input 
                      type="text" 
                      value={editingBrand.contact}
                      onChange={(e) => setEditingBrand({ ...editingBrand, contact: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-sm focus:outline-none focus:border-[#d4af37] transition-all"
                      placeholder="Ex: @luminaai, lumina.com.br"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Tipografia Preferida</label>
                    <select 
                      value={editingBrand.typography}
                      onChange={(e) => setEditingBrand({ ...editingBrand, typography: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-sm focus:outline-none focus:border-[#d4af37] transition-all appearance-none"
                    >
                      <option value="Modern">Modern</option>
                      <option value="Classic">Classic</option>
                      <option value="Minimal">Minimal</option>
                      <option value="Bold">Bold</option>
                      <option value="Elegant">Elegant</option>
                    </select>
                  </div>

                  {editingBrand.styleAnalysis && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="md:col-span-2 p-6 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-3xl space-y-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={16} className="text-[#d4af37]" />
                        <h4 className="text-xs font-black text-[#d4af37] uppercase tracking-[0.2em]">Padrão Estratégico Detectado (IA)</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Estilo Dominante</span>
                          <p className="text-xs text-gray-300 leading-relaxed">{editingBrand.styleAnalysis}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Tom de Voz</span>
                          <p className="text-xs text-gray-300 leading-relaxed">{editingBrand.toneOfVoice}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="mt-10 flex justify-end gap-4">
                  <button 
                    onClick={async () => {
                      if (!user) {
                        showNotification("Você precisa estar logado para salvar marcas.", "info");
                        return;
                      }
                      setIsAnalyzingBrand(true);
                      try {
                        const brandRef = doc(db, `users/${user.uid}/brands`, editingBrand.id);
                        await setDoc(brandRef, editingBrand);
                        setBrandStep('list');
                        setEditingBrand(null);
                      } catch (error) {
                        console.error("Failed to save brand:", error);
                        showNotification("Erro ao salvar marca no servidor.", "error");
                      } finally {
                        setIsAnalyzingBrand(false);
                      }
                    }}
                    disabled={!editingBrand.name || isAnalyzingBrand}
                    className="px-10 py-4 bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black rounded-2xl hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAnalyzingBrand ? 'SALVANDO...' : 'SALVAR MARCA'}
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {activeTab === 'creative_studio' && (
          <div className="w-full max-w-full mx-auto py-8 px-4 md:px-8">
            <div className="flex flex-col gap-8">
              {/* Creative Studio Controls - Horizontal Layout */}
              <div className="w-full">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#111] p-8 rounded-[40px] border border-[#222]"
                >
                  <form onSubmit={handleCreate} className="flex flex-col gap-8">
                    <div className="flex flex-wrap items-start gap-8">
                      {/* Left Column: Modes and Type */}
                      <div className="flex-1 min-w-[300px] space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <Sparkles size={24} className="text-[#d4af37]" />
                          <h3 className="font-bold text-xl">Estúdio Lumina</h3>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Modos do Studio</label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'pro', label: 'Foto Profissional', icon: User, prompt: 'Professional corporate headshot, high-end business attire, studio lighting, clean background, sharp focus, 8k' },
                              { id: 'avatar', label: 'Avatar 3D', icon: Sparkles, prompt: '3D stylized avatar character, Pixar style, high detail, vibrant colors, expressive features, soft lighting' },
                              { id: 'swap', label: 'Troca de Personagem', icon: Layers, prompt: 'Face swap integration, maintaining lighting and composition, seamless blend' },
                              { id: 'product', label: 'Personagem + Produto', icon: ShoppingBag, prompt: 'Professional model interacting with product, lifestyle photography, commercial lighting, high-end advertising' }
                            ].map((mode) => (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => {
                                  setStudioMode(mode.id);
                                  setPrompt(mode.prompt);
                                  setType('image');
                                }}
                                className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${studioMode === mode.id ? 'bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500 hover:border-[#333]'}`}
                              >
                                <div className={`p-1 rounded-lg ${studioMode === mode.id ? 'bg-[#d4af37] text-black' : 'bg-[#222] text-gray-400'}`}>
                                  <mode.icon size={12} />
                                </div>
                                <span className="text-[10px] font-bold text-left leading-tight uppercase tracking-wider">{mode.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Tipo de Geração</label>
                            <button 
                              type="button"
                              onClick={() => setFastMode(!fastMode)}
                              className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black transition-all border ${fastMode ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1a1a1a] text-gray-500 border-[#222] hover:border-[#333]'}`}
                            >
                              <Zap size={8} fill={fastMode ? "currentColor" : "none"} />
                              {fastMode ? 'TURBO' : 'QUALIDADE'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              type="button"
                              onClick={() => setType('video')}
                              className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${type === 'video' ? 'border-[#d4af37] bg-[#d4af37]/5 text-[#d4af37]' : 'border-[#222] bg-[#1a1a1a] text-gray-500 hover:border-[#333]'}`}
                            >
                              <Video size={20} />
                              <span className="text-[11px] font-black uppercase tracking-widest">Vídeo Veo 3.1</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => setType('image')}
                              className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${type === 'image' ? 'border-[#d4af37] bg-[#d4af37]/5 text-[#d4af37]' : 'border-[#222] bg-[#1a1a1a] text-gray-500 hover:border-[#333]'}`}
                            >
                              <ImageIcon size={20} />
                              <span className="text-[11px] font-black uppercase tracking-widest">Imagem Pro</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Middle Column: Assets and Prompt */}
                      <div className="flex-[2] min-w-[400px] space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Personagem / Referência</label>
                              {refAsset && (
                                <button type="button" onClick={analyzeAssetForPrompt} disabled={isAnalyzing} className="text-[9px] font-black text-[#d4af37] flex items-center gap-1 uppercase">
                                  {isAnalyzing ? "..." : <Sparkles size={10} />}
                                </button>
                              )}
                            </div>
                            <input type="file" onChange={handleRefAssetUpload} className="hidden" ref={refAssetInputRef} accept="image/*,video/*" />
                            <div 
                              className={`w-full h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all relative overflow-hidden ${refAsset ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] bg-[#1a1a1a] hover:border-[#333] cursor-pointer'}`}
                              onClick={() => !refAsset && refAssetInputRef.current?.click()}
                            >
                              {refAsset ? (
                                <>
                                  {refAsset.type === 'image' ? (
                                    <img src={`data:${refAsset.mimeType};base64,${refAsset.data}`} className="h-full w-full object-contain p-2" />
                                  ) : (
                                    <video src={`data:${refAsset.mimeType};base64,${refAsset.data}`} className="h-full w-full object-contain p-2" />
                                  )}
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setRefAsset(null); }} className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-all">
                                    <Trash2 size={10} />
                                  </button>
                                </>
                              ) : (
                                <div className="text-center">
                                  <User size={14} className="text-gray-600 mx-auto mb-1" />
                                  <span className="text-[10px] font-bold text-gray-500 uppercase">Personagem</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Produto</label>
                            </div>
                            <input type="file" onChange={handleProductAssetUpload} className="hidden" ref={productAssetInputRef} accept="image/*" />
                            <div 
                              className={`w-full h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all relative overflow-hidden ${productAsset ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] bg-[#1a1a1a] hover:border-[#333] cursor-pointer'}`}
                              onClick={() => !productAsset && productAssetInputRef.current?.click()}
                            >
                              {productAsset ? (
                                <>
                                  <img src={`data:${productAsset.mimeType};base64,${productAsset.data}`} className="h-full w-full object-contain p-2" />
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setProductAsset(null); }} className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-all">
                                    <Trash2 size={10} />
                                  </button>
                                </>
                              ) : (
                                <div className="text-center">
                                  <ShoppingBag size={14} className="text-gray-600 mx-auto mb-1" />
                                  <span className="text-[8px] font-bold text-gray-500 uppercase">Produto</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Prompt Criativo</label>
                          </div>
                          <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Descreva sua visão..."
                            className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-4 focus:outline-none focus:border-[#d4af37] transition-colors resize-none text-sm h-24"
                            required
                          />
                        </div>
                      </div>

                      {/* Right Column: Styles and Settings */}
                      <div className="flex-1 min-w-[300px] space-y-6">
                        <div className="bg-[#1a1a1a] border border-[#222] rounded-2xl overflow-hidden">
                          <div className="p-3 border-b border-[#222] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Wand2 size={14} className="text-[#d4af37]" />
                              <span className="text-xs font-black text-white uppercase tracking-widest">Estilos</span>
                            </div>
                            <button
                              type="button"
                              onClick={enhancePromptWithAI}
                              disabled={isEnhancing || !prompt.trim()}
                              className="bg-[#d4af37] text-black px-2 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                              {isEnhancing ? <div className="w-2 h-2 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Zap size={10} fill="currentColor" />}
                              IA
                            </button>
                          </div>
                          <div className="p-3">
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: 'Cinematográfico', label: 'CINEMA', icon: Video },
                                { id: 'Cyberpunk', label: 'CYBER', icon: Zap },
                                { id: 'Realismo Extremo', label: 'REAL', icon: ImageIcon },
                                { id: 'Anime', label: 'ANIME', icon: Sparkles },
                                { id: 'Pintura', label: 'ARTE', icon: Palette },
                                { id: '3D Render', label: '3D', icon: Maximize },
                                { id: 'Vintage', label: 'VINTAGE', icon: Clock },
                              ].map((style) => (
                                <button
                                  key={style.id}
                                  type="button"
                                  onClick={() => applyStyle(style.id)}
                                  className={`p-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-all group ${selectedStyle === style.id ? 'bg-[#d4af37]/20 border-[#d4af37]' : 'bg-black/20 border border-white/5 hover:border-[#d4af37]/50'}`}
                                >
                                  <style.icon size={12} className={selectedStyle === style.id ? 'text-[#d4af37]' : 'text-gray-600 group-hover:text-[#d4af37]'} />
                                  <span className={`text-[10px] font-black tracking-tighter uppercase ${selectedStyle === style.id ? 'text-white' : 'text-gray-500 group-hover:text-white'}`}>
                                    {style.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">Formato</label>
                            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#222] rounded-lg p-2 text-xs focus:outline-none focus:border-[#d4af37] appearance-none">
                              <option value="9:16">9:16</option>
                              <option value="16:9">16:9</option>
                              <option value="1:1">1:1</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">Qualidade</label>
                            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#222] rounded-lg p-2 text-xs focus:outline-none focus:border-[#d4af37] appearance-none">
                              <option value="720p">720p</option>
                              <option value="1080p">1080p</option>
                              <option value="2K">2K</option>
                              <option value="4K">4K</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setLowPriority(!lowPriority)}
                            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border text-[11px] font-bold transition-all ${lowPriority ? 'bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
                          >
                            <Clock size={12} />
                            ECONOMIA
                          </button>
                          <button
                            type="button"
                            onClick={() => setUseGrounding(!useGrounding)}
                            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border text-[11px] font-bold transition-all ${useGrounding ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
                          >
                            <Globe size={12} />
                            GROUNDING
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Quantidade</label>
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 5, 10].map(n => (
                              <button 
                                key={n} 
                                type="button" 
                                onClick={() => setQuantity(n)}
                                className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${quantity === n ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        {type === 'video' && (
                          <div className="flex flex-col">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Duração</label>
                            <div className="flex gap-1 mt-1">
                              {[4, 8].map(d => (
                                <button 
                                  key={d} 
                                  type="button" 
                                  onClick={() => setVideoDuration(d)}
                                  className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${videoDuration === d ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
                                >
                                  {d}s
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        type="submit"
                        disabled={isProcessing}
                        className="min-w-[300px] bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black py-4 rounded-2xl shadow-xl shadow-[#d4af37]/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 text-base"
                        onClick={(e) => handleCreate(e, false, false)}
                      >
                        {isProcessing ? <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin" /> : <Play size={20} fill="currentColor" />}
                        GERAR ({getCostPerItem(false, false) * quantity * Math.max(1, prompt.split('\n').filter(p => p.trim() !== '').length)} CRÉDITOS)
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>

              {/* Results Gallery - Below Controls, More Compact */}
              <div className="w-full space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">Galeria Studio</h3>
                    <p className="text-gray-500 text-xs">Suas criações recentes aparecem aqui em tempo real.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('library')}
                    className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest hover:underline flex items-center gap-2"
                  >
                    Ver Biblioteca Completa <ArrowRight size={12} />
                  </button>
                </div>

                {batch.filter(item => item.sourceTab === 'creative_studio').length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {batch.filter(item => item.sourceTab === 'creative_studio').map((item, i) => {
                      const studioList = batch.filter(item => item.sourceTab === 'creative_studio');
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="bg-[#111] rounded-[24px] border border-[#222] overflow-hidden group relative"
                        >
                          <div 
                            className="aspect-[9/16] bg-black relative cursor-pointer overflow-hidden"
                            onClick={() => openPreview(item, studioList)}
                          >
                          {sessionPreviews[item.id] || item.previewUrl ? (
                            item.type === 'video' ? (
                              <video 
                                src={sessionPreviews[item.id] || item.previewUrl} 
                                className="w-full h-full object-cover" 
                                muted
                                loop
                                onMouseOver={e => e.currentTarget.play()}
                                onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                              />
                            ) : (
                              <img 
                                src={sessionPreviews[item.id] || item.previewUrl} 
                                alt={item.prompt}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                              />
                            )
                          ) : item.status === 'failed' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2">
                              <AlertCircle size={24} className="text-red-500/50" />
                              <p className="text-[10px] text-red-400 font-medium leading-tight line-clamp-3">{item.error}</p>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                              <div className="relative">
                                <div className="w-10 h-10 border-3 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[#d4af37]">
                                  {item.progress}%
                                </div>
                              </div>
                              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Gerando...</span>
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                              {item.type === 'video' ? <Play size={16} className="text-white fill-white ml-0.5" /> : <Maximize2 size={16} className="text-white" />}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 flex items-center justify-between bg-[#161616]">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'completed' ? 'bg-green-500' : item.status === 'failed' ? 'bg-red-500' : 'bg-[#d4af37] animate-pulse'}`} />
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                              {item.status === 'completed' ? 'OK' : item.status === 'failed' ? 'ERRO' : '...'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {(sessionPreviews[item.id] || item.previewUrl) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(sessionPreviews[item.id] || item.previewUrl!, item.id);
                                }}
                                className="text-gray-600 hover:text-[#d4af37] transition-colors"
                                title="Baixar"
                              >
                                <Download size={12} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              className="text-gray-600 hover:text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#111] rounded-[40px] border border-[#222] border-dashed p-12 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-[#222]">
                      <Sparkles size={24} className="text-gray-700" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-gray-400">Nenhuma criação ainda</h4>
                      <p className="text-gray-600 text-xs max-w-xs mx-auto">Use o painel acima para começar a criar artes e vídeos profissionais.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- LipSync Tab --- */}
        {activeTab === 'lipsync' && (
          <div className="w-full max-w-6xl mx-auto py-8 px-4 md:px-8">
            <div className="flex flex-col gap-8">
              {/* Lipsync Controls - Horizontal/Top Layout */}
              <div className="w-full">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-[#111] p-8 md:p-10 rounded-[40px] border transition-all ${useLipsync && lipsyncAudio ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/10' : 'border-[#222]'}`}
                >
                  <div className="flex flex-wrap items-start gap-10">
                    {/* Left: Title and Toggle */}
                    <div className="w-full lg:w-auto lg:min-w-[280px] space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mic size={24} className={useLipsync && lipsyncAudio ? 'text-[#d4af37]' : 'text-gray-500'} />
                          <h3 className="font-bold text-xl">Lip Sync Studio</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextValue = !useLipsync;
                            setUseLipsync(nextValue);
                            if (nextValue && !lipsyncAsset && refAsset) {
                              setLipsyncAsset(refAsset);
                            }
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative ${useLipsync ? 'bg-[#d4af37]' : 'bg-gray-700'}`}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useLipsync ? 'translate-x-6' : ''}`} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div 
                          className={`aspect-square bg-[#1a1a1a] rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative group ${lipsyncAsset ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] hover:border-[#333] cursor-pointer'}`}
                          onClick={() => !lipsyncAsset && lipsyncAssetInputRef.current?.click()}
                        >
                          <input 
                            ref={lipsyncAssetInputRef}
                            type="file" 
                            className="hidden" 
                            accept="image/*,video/*" 
                            onChange={handleLipsyncAssetUpload} 
                            onClick={(e) => e.stopPropagation()}
                          />
                          {lipsyncAsset ? (
                            <>
                              {lipsyncAsset.type === 'image' ? (
                                <img 
                                  src={`data:${lipsyncAsset.mimeType};base64,${lipsyncAsset.data}`} 
                                  alt="Ref" 
                                  className="w-full h-full object-cover rounded-2xl cursor-pointer hover:opacity-80 transition-opacity" 
                                  onClick={(e) => { e.stopPropagation(); setSelectedMedia({ url: `data:${lipsyncAsset.mimeType};base64,${lipsyncAsset.data}`, type: lipsyncAsset.type }); }}
                                />
                              ) : (
                                <video 
                                  src={`data:${lipsyncAsset.mimeType};base64,${lipsyncAsset.data}`} 
                                  className="w-full h-full object-cover rounded-2xl cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLipsyncAsset(null); }}
                                className="absolute top-2 right-2 w-8 h-8 bg-black/80 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-red-500/30"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <User size={24} className="text-gray-600" />
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Personagem</span>
                            </>
                          )}
                        </div>

                        <div 
                          className={`aspect-square bg-[#1a1a1a] rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative group ${lipsyncProductAsset ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] hover:border-[#333] cursor-pointer'}`}
                          onClick={() => !lipsyncProductAsset && lipsyncProductAssetInputRef.current?.click()}
                        >
                          <input 
                            ref={lipsyncProductAssetInputRef}
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleLipsyncProductAssetUpload} 
                            onClick={(e) => e.stopPropagation()}
                          />
                          {lipsyncProductAsset ? (
                            <>
                              <img 
                                src={`data:${lipsyncProductAsset.mimeType};base64,${lipsyncProductAsset.data}`} 
                                alt="Product" 
                                className="w-full h-full object-cover rounded-2xl cursor-pointer hover:opacity-80 transition-opacity" 
                                onClick={(e) => { e.stopPropagation(); setSelectedMedia({ url: `data:${lipsyncProductAsset.mimeType};base64,${lipsyncProductAsset.data}`, type: 'image' }); }}
                              />
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLipsyncProductAsset(null); }}
                                className="absolute top-2 right-2 w-8 h-8 bg-black/80 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-red-500/30"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <ShoppingBag size={24} className="text-gray-600" />
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Produto</span>
                            </>
                          )}
                        </div>

                        <div 
                          className={`aspect-square bg-[#1a1a1a] rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative group ${lipsyncAudio || lipsyncAudioPrompt.trim() !== '' ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] hover:border-[#333] cursor-pointer'}`}
                          onClick={() => !lipsyncAudio && audioInputRef.current?.click()}
                        >
                          <input 
                            ref={audioInputRef}
                            type="file" 
                            className="hidden" 
                            accept="audio/*" 
                            onChange={handleAudioUpload} 
                            onClick={(e) => e.stopPropagation()}
                          />
                          {lipsyncAudio ? (
                            <>
                              <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); isAudioPlaying ? pauseAudio() : playAudio(); }}
                                    className="w-10 h-10 bg-[#d4af37] text-black rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-lg"
                                  >
                                    {isAudioPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                                  </button>
                                </div>
                                <span className="text-[10px] font-bold text-[#d4af37] uppercase">Áudio OK</span>
                              </div>
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLipsyncAudio(null); setIsAudioPlaying(false); }}
                                className="absolute top-2 right-2 w-8 h-8 bg-black/80 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-red-500/30"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : lipsyncAudioPrompt.trim() !== '' ? (
                            <div className="flex flex-col items-center gap-2 px-2 text-center">
                              <Mic size={24} className="text-[#d4af37]" />
                              <span className="text-[10px] font-bold text-[#d4af37] uppercase">Prompt Ativo</span>
                            </div>
                          ) : (
                            <>
                              <Mic size={24} className="text-gray-600" />
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Áudio</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Audio Prompt and Settings */}
                    <div className="flex-1 min-w-[300px] space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Texto para Voz / Prompt</label>
                        <textarea 
                          value={lipsyncAudioPrompt}
                          onChange={(e) => setLipsyncAudioPrompt(e.target.value)}
                          placeholder="Ou digite o texto para a voz..."
                          className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-5 text-base focus:outline-none focus:border-[#d4af37] min-h-[120px] transition-all placeholder:text-gray-700 resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Formato</label>
                          <select value={lipsyncAspectRatio} onChange={(e) => setLipsyncAspectRatio(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-3 text-sm focus:outline-none focus:border-[#d4af37] appearance-none">
                            <option value="9:16">9:16 (Vertical)</option>
                            <option value="16:9">16:9 (Horizontal)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Duração</label>
                          <select value={lipsyncDuration} onChange={(e) => setLipsyncDuration(parseInt(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-3 text-sm focus:outline-none focus:border-[#d4af37] appearance-none">
                            <option value={4}>4 Segundos</option>
                            <option value={8}>8 Segundos</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="w-full lg:w-auto lg:min-w-[280px] space-y-4 pt-6 lg:pt-0">
                      <button
                        type="button"
                        onClick={() => setLipsyncLowPriority(!lipsyncLowPriority)}
                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-2xl border text-[11px] font-bold transition-all ${lipsyncLowPriority ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
                      >
                        <Clock size={16} />
                        MODO ECONOMIA (FILA LENTA)
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing || (!lipsyncAudio && lipsyncAudioPrompt.trim() === '') || !lipsyncAsset}
                        onClick={(e) => handleCreate(e, true)}
                        className="w-full bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black py-6 rounded-3xl shadow-xl shadow-[#d4af37]/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 text-base">
                          {isProcessing ? <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin" /> : <Mic size={20} fill="currentColor" />}
                          <span>GERAR LIP SYNC</span>
                        </div>
                        <span className="text-[10px] opacity-80 font-bold uppercase tracking-tighter">Custo: {getCostPerItem(true, false) * lipsyncQuantity} CRÉDITOS</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Results Gallery - Below Controls */}
              <div className="w-full space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold">Resultados LipSync</h3>
                    <p className="text-gray-500 text-sm">Suas sincronizações labiais recentes aparecem aqui.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('library')}
                    className="text-xs font-bold text-[#d4af37] uppercase tracking-widest hover:underline flex items-center gap-2"
                  >
                    Ver Biblioteca Completa <ArrowRight size={14} />
                  </button>
                </div>

                {batch.filter(item => item.sourceTab === 'lipsync').length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {batch.filter(item => item.sourceTab === 'lipsync').map((item, i) => {
                      const lipsyncList = batch.filter(item => item.sourceTab === 'lipsync');
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="bg-[#111] rounded-[32px] border border-[#222] overflow-hidden group relative"
                        >
                          <div 
                            className="aspect-[9/16] bg-black relative cursor-pointer overflow-hidden"
                            onClick={() => openPreview(item, lipsyncList)}
                          >
                          {sessionPreviews[item.id] || item.previewUrl ? (
                            <video 
                              src={sessionPreviews[item.id] || item.previewUrl} 
                              className="w-full h-full object-cover" 
                              muted
                              loop
                              onMouseOver={e => e.currentTarget.play()}
                              onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                            />
                          ) : item.status === 'failed' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4">
                              <AlertCircle size={40} className="text-red-500/50" />
                              <p className="text-[10px] text-red-400 font-medium leading-relaxed">{item.error}</p>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                              <div className="relative">
                                <div className="w-16 h-16 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[#d4af37]">
                                  {item.progress}%
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Processando...</span>
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                              <Play size={20} className="text-white fill-white ml-1" />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 flex items-center justify-between bg-[#161616]">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${item.status === 'completed' ? 'bg-green-500' : item.status === 'failed' ? 'bg-red-500' : 'bg-[#d4af37] animate-pulse'}`} />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              {item.status === 'completed' ? 'Finalizado' : item.status === 'failed' ? 'Falhou' : 'Gerando'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {(sessionPreviews[item.id] || item.previewUrl) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(sessionPreviews[item.id] || item.previewUrl!, item.id);
                                }}
                                className="text-gray-600 hover:text-[#d4af37] transition-colors"
                                title="Baixar"
                              >
                                <Download size={14} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              className="text-gray-600 hover:text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#111] rounded-[40px] border border-[#222] border-dashed p-20 flex flex-col items-center justify-center text-center gap-6">
                  <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-[#222]">
                    <Mic size={32} className="text-gray-700" />
                  </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-gray-400">Nenhum LipSync gerado ainda</h4>
                      <p className="text-gray-600 text-sm max-w-xs mx-auto">Use o painel ao lado para criar sua primeira sincronização labial de alta fidelidade.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- Projects Tab --- */}
        {activeTab === 'projects' && (
          <div className="w-full max-w-full mx-auto py-8 px-4 md:px-8">
            <div className="flex flex-col gap-8">
              {/* Projects Controls - Horizontal/Top Layout */}
              <div className="w-full">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-[#111] p-8 md:p-10 rounded-[40px] border transition-all ${useCreativeStudio ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/10' : 'border-[#222]'}`}
                >
                  <div className="flex flex-wrap items-start gap-10">
                    {/* Left: Brand and Logo */}
                    <div className="w-full lg:w-auto lg:min-w-[300px] space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Target size={24} className="text-[#d4af37]" />
                          <h3 className="font-bold text-xl">Projetos Criativos Ads</h3>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-full">
                          <div className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
                          <span className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest">ADS Mode Active</span>
                        </div>
                      </div>

                      {/* Brand Selector Dropdown */}
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Marca Selecionada</label>
                        <select 
                          value={activeBrandProfileId || ''} 
                          onChange={(e) => {
                            const brandId = e.target.value;
                            const brand = brandProfiles.find(b => b.id === brandId);
                            if (brand) {
                              setActiveBrandProfileId(brand.id);
                              if (brand.logos && brand.logos.length > 0) {
                                setCreativeLogo(brand.logos[0]);
                              }
                              setCreativeColors(brand.colors);
                              setCreativeTypography(brand.typography);
                            } else {
                              setActiveBrandProfileId(null);
                              setCreativeLogo(null);
                              setCreativeColors([]);
                              setCreativeTypography('Modern');
                            }
                          }}
                          className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-[#d4af37] appearance-none cursor-pointer"
                        >
                          <option value="">Selecione uma marca...</option>
                          {brandProfiles.map(brand => (
                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 bottom-3.5 text-gray-500 pointer-events-none" />
                      </div>

                      {activeBrandProfileId && brandProfiles.find(b => b.id === activeBrandProfileId) && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 bg-gradient-to-br from-[#d4af37]/10 to-transparent border border-[#d4af37]/20 rounded-3xl space-y-3 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-3 opacity-5">
                            <Zap size={40} className="text-[#d4af37]" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#d4af37] text-black rounded-lg flex items-center justify-center">
                              <Zap size={10} fill="currentColor" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">DNA da Marca Ativado</span>
                          </div>
                          {brandProfiles.find(b => b.id === activeBrandProfileId)?.styleAnalysis && (
                            <p className="text-[11px] text-gray-400 leading-relaxed font-medium line-clamp-3">
                              "{brandProfiles.find(b => b.id === activeBrandProfileId)?.styleAnalysis}"
                            </p>
                          )}
                        </motion.div>
                      )}

                      {/* Logo Display/Upload */}
                      <div className="flex flex-col gap-4">
                        <div 
                          className={`w-full max-w-[200px] aspect-square bg-[#1a1a1a] rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative group overflow-hidden ${creativeLogo ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] hover:border-[#333] cursor-pointer'}`}
                          onClick={() => !creativeLogo && creativeLogoInputRef.current?.click()}
                        >
                          <input 
                            ref={creativeLogoInputRef}
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleCreativeLogoUpload} 
                          />
                          {creativeLogo ? (
                            <>
                              <img 
                                src={`data:${creativeLogo.mimeType};base64,${creativeLogo.data}`} 
                                alt="Logo" 
                                className="w-full h-full object-contain p-4" 
                              />
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCreativeLogo(null); setCreativeColors([]); }}
                                className="absolute top-2 right-2 w-7 h-7 bg-black/80 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-red-500/30"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <ImagePlus size={20} className="text-gray-600" />
                              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none">Logo</span>
                            </>
                          )}
                        </div>

                        {activeBrandProfileId && (
                          <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                            <div>
                              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-2">Paleta Institucional</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {creativeColors && creativeColors.length > 0 ? (
                                  creativeColors.map((color, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: color }} title={color} />
                                  ))
                                ) : (
                                  <span className="text-[8px] text-gray-600 italic">Nenhuma cor</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Tipografia Base</span>
                              <span className="text-[10px] font-bold text-[#d4af37] uppercase">{creativeTypography || 'Modern'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle: Prompt and Formats */}
                    <div className="flex-1 min-w-[350px] space-y-6">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Instruções do Criativo (Prompt)</label>
                        <div className="relative">
                          <textarea 
                            value={creativePrompt}
                            onChange={(e) => setCreativePrompt(e.target.value)}
                            placeholder="Ex: Crie um anúncio de verão com foco em frescor e elegância..."
                            className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-5 text-sm focus:outline-none focus:border-[#d4af37] transition-colors resize-none h-32"
                          />
                        </div>
                        
                        {/* Reference Assets for Creative Studio */}
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            ref={creativeRefAssetInputRef}
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleCreativeRefAssetUpload} 
                          />
                          <input 
                            ref={creativeProductAssetInputRef}
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleCreativeProductAssetUpload} 
                          />
                          
                          <button
                            type="button"
                            onClick={() => creativeRefAssetInputRef.current?.click()}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${creativeRefAsset ? 'bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]' : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/20'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${creativeRefAsset ? 'bg-[#d4af37] text-black' : 'bg-[#222]'}`}>
                              <User size={16} />
                            </div>
                            <div className="text-left">
                              <span className="block text-[10px] font-black uppercase tracking-tighter">Personagem</span>
                              <span className="block text-[9px] opacity-70">{creativeRefAsset ? 'Carregado ✓' : 'Add Referência'}</span>
                            </div>
                            {creativeRefAsset && (
                              <div className="ml-auto" onClick={(e) => { e.stopPropagation(); setCreativeRefAsset(null); }}>
                                <X size={14} className="hover:text-red-500" />
                              </div>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => creativeProductAssetInputRef.current?.click()}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${creativeProductAsset ? 'bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]' : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/20'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${creativeProductAsset ? 'bg-[#d4af37] text-black' : 'bg-[#222]'}`}>
                              <Package size={16} />
                            </div>
                            <div className="text-left">
                              <span className="block text-[10px] font-black uppercase tracking-tighter">Produto</span>
                              <span className="block text-[9px] opacity-70">{creativeProductAsset ? 'Carregado ✓' : 'Add Referência'}</span>
                            </div>
                            {creativeProductAsset && (
                              <div className="ml-auto" onClick={(e) => { e.stopPropagation(); setCreativeProductAsset(null); }}>
                                <X size={14} className="hover:text-red-500" />
                              </div>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Formato</label>
                          <select 
                            value={creativeFormat} 
                            onChange={(e) => setCreativeFormat(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-[#d4af37] appearance-none"
                          >
                            <option value="Instagram Post 1:1">Instagram Post (1:1)</option>
                            <option value="Facebook Ad 1.91:1">Facebook Ad (1.91:1)</option>
                            <option value="TikTok Video 9:16">TikTok Video (9:16)</option>
                            <option value="Stories 9:16">Stories (9:16)</option>
                            <option value="YouTube 16:9">YouTube (16:9)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Tipografia</label>
                          <select 
                            value={creativeTypography} 
                            onChange={(e) => setCreativeTypography(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-[#d4af37] appearance-none"
                          >
                            <option value="Modern">Modern Sans</option>
                            <option value="Elegant">Elegant Serif</option>
                            <option value="Bold">Bold Impact</option>
                            <option value="Minimalist">Minimalist</option>
                            <option value="Tech">Futuristic Tech</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="w-full lg:w-auto lg:min-w-[280px] space-y-6 pt-6 lg:pt-0">
                      <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                        <label className="block text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-widest">Quantidade</label>
                        <div className="flex gap-2">
                          {[1, 3, 5, 10].map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setCreativeQuantity(q)}
                              className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all ${creativeQuantity === q ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500 hover:border-[#333]'}`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isProcessing || !creativeLogo}
                        onClick={(e) => handleCreate(e, false, true)}
                        className="w-full bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black py-6 rounded-3xl shadow-xl shadow-[#d4af37]/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col items-center justify-center gap-1 text-base disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          {isProcessing ? <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin" /> : <Sparkles size={20} fill="currentColor" />}
                          <span>GERAR CRIATIVOS</span>
                        </div>
                        <span className="text-[10px] opacity-80 font-bold uppercase tracking-tighter">Custo: {getCostPerItem(false, true) * creativeQuantity} CRÉDITOS</span>
                      </button>
                    </div>
                  </div>

                  {/* Creative Styles and Strategies - Unified Performance Panel */}
                  <div className="w-full mt-10 pt-10 border-t border-[#222]">
                    <div className="flex flex-col lg:flex-row gap-10">
                      
                      {/* Left: Performance Core */}
                      <div className="flex-1 space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center border border-[#d4af37]/20">
                            <TrendingUp size={20} className="text-[#d4af37]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Estratégia de Performance</h4>
                            <p className="text-[10px] text-gray-500 font-medium">Configure os pilares psicológicos do seu anúncio</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Objetivo da Campanha</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'conversoes', label: 'Vendas/Conversão' },
                                { id: 'lead', label: 'Captação Leads' },
                                { id: 'engajamento', label: 'Viral/Social' },
                                { id: 'awareness', label: 'Branding/Impacto' }
                              ].map(goal => (
                                <button
                                  key={goal.id}
                                  type="button"
                                  onClick={() => setAdGoal(goal.id as any)}
                                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${adGoal === goal.id ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-black/40 border-white/5 text-gray-500 hover:border-[#d4af37]/30'}`}
                                >
                                  {goal.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Gatilho Psicológico Master</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'desejo', label: 'DESEJO' },
                                { id: 'escassez', label: 'ESCASSEZ' },
                                { id: 'urgencia', label: 'URGÊNCIA' },
                                { id: 'autoridade', label: 'AUTORIDADE' },
                                { id: 'prova_social', label: 'PROVA SOCIAL' },
                                { id: 'curiosidade', label: 'CURIOSIDADE' }
                              ].map(trigger => (
                                <button
                                  key={trigger.id}
                                  type="button"
                                  onClick={() => setAdTrigger(trigger.id as any)}
                                  className={`px-1 py-2 rounded-xl border text-[10px] font-black transition-all ${adTrigger === trigger.id ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/20'}`}
                                >
                                  {trigger.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4">
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Otimização Plataforma Nativa</label>
                          <div className="flex gap-2">
                            {[
                              { id: 'instagram', label: 'META (Insta/FB Ad)' },
                              { id: 'tiktok', label: 'TIKTOK ADS (UGC)' },
                              { id: 'youtube', label: 'YT SHORTS / VSL' },
                              { id: 'facebook', label: 'FACEBOOK FEED' }
                            ].map(plat => (
                              <button
                                key={plat.id}
                                type="button"
                                onClick={() => setAdPlatform(plat.id as any)}
                                className={`flex-1 px-3 py-3 rounded-xl border text-xs font-black transition-all ${adPlatform === plat.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-black/40 border-white/5 text-gray-500 hover:border-blue-600/30'}`}
                              >
                                {plat.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Style & Aesthetic */}
                      <div className="w-full lg:w-[350px] space-y-8">
                        <div className="space-y-4">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ângulo de Venda</label>
                          <select 
                            value={creativeStrategy}
                            onChange={(e) => setCreativeStrategy(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 text-gray-300 rounded-xl p-3 text-xs font-bold focus:border-[#d4af37]"
                          >
                            {CREATIVE_STRATEGIES.map(s => <option key={s.id} value={s.name}>{s.name} - {s.description}</option>)}
                          </select>
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estética do Criativo</label>
                          <select 
                            value={creativeAesthetic}
                            onChange={(e) => setCreativeAesthetic(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 text-gray-300 rounded-xl p-3 text-xs font-bold focus:border-[#d4af37]"
                          >
                            {CREATIVE_AESTHETICS.map(a => <option key={a.id} value={a.name}>{a.name} - {a.description}</option>)}
                          </select>
                        </div>
                        
                        <div className="p-5 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#d4af37] flex items-center justify-center text-black">
                            <Sparkles size={16} fill="currentColor" />
                          </div>
                          <p className="text-[10px] text-gray-400 leading-tight">
                            <span className="text-white font-bold block mb-0.5">IA Smart Optimization Ativa</span>
                            A IA ajustará automaticamente a composição para o formato <span className="text-[#d4af37]">{creativeFormat}</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Results Gallery - Below Controls */}
              <div className="w-full space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold">Galeria de Projetos</h3>
                    <p className="text-gray-500 text-sm">Seus criativos publicitários aparecem aqui em tempo real.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('library')}
                    className="text-xs font-bold text-[#d4af37] uppercase tracking-widest hover:underline flex items-center gap-2"
                  >
                    Ver Biblioteca Completa <ArrowRight size={14} />
                  </button>
                </div>

                {batch.filter(item => item.sourceTab === 'projects').length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {batch.filter(item => item.sourceTab === 'projects').map((item, i) => {
                      const projectsList = batch.filter(item => item.sourceTab === 'projects');
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden group relative"
                        >
                          <div 
                            className="aspect-[9/16] bg-black relative cursor-pointer overflow-hidden"
                            onClick={() => openPreview(item, projectsList)}
                          >
                          {sessionPreviews[item.id] || item.previewUrl ? (
                            item.type === 'video' ? (
                              <video 
                                src={sessionPreviews[item.id] || item.previewUrl} 
                                className="w-full h-full object-cover" 
                                muted
                                loop
                                onMouseOver={e => e.currentTarget.play()}
                                onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                              />
                            ) : (
                              <img 
                                src={sessionPreviews[item.id] || item.previewUrl} 
                                alt={item.prompt}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                              />
                            )
                          ) : item.status === 'failed' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4">
                              <AlertCircle size={40} className="text-red-500/50" />
                              <p className="text-[10px] text-red-400 font-medium leading-relaxed">{item.error}</p>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                              <div className="relative">
                                <div className="w-16 h-16 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[#d4af37]">
                                  {item.progress}%
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Processando...</span>
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                              {item.type === 'video' ? <Play size={20} className="text-white fill-white ml-1" /> : <Maximize2 size={20} className="text-white" />}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 flex items-center justify-between bg-[#161616]">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${item.status === 'completed' ? 'bg-green-500' : item.status === 'failed' ? 'bg-red-500' : 'bg-[#d4af37] animate-pulse'}`} />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              {item.status === 'completed' ? 'Finalizado' : item.status === 'failed' ? 'Falhou' : 'Gerando'}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#111] rounded-[40px] border border-[#222] border-dashed p-20 flex flex-col items-center justify-center text-center gap-6">
                  <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-[#222]">
                    <Briefcase size={32} className="text-gray-700" />
                  </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-gray-400">Nenhum projeto gerado ainda</h4>
                      <p className="text-gray-600 text-sm max-w-xs mx-auto">Use o painel ao lado para começar a criar anúncios profissionais para sua marca.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* --- Library Tab --- */}
        {activeTab === 'library' && (
          <div className="space-y-8">
            <div className="flex gap-4 p-1 bg-[#111] rounded-2xl border border-[#222] w-fit">
              {[
                { id: 'all', label: 'TUDO', icon: Layers },
                { id: 'image', label: 'IMAGENS', icon: ImageIcon },
                { id: 'video', label: 'VÍDEOS', icon: Video },
                { id: 'lipsync', label: 'LIPSYNC', icon: Mic },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLibraryFilter(f.id as any)}
                  className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-xs transition-all ${libraryFilter === f.id ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}
                >
                  <f.icon size={16} />
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {(() => {
                const filteredList = batch
                  .filter(item => item.status === 'completed')
                  .filter(item => {
                    if (libraryFilter === 'all') return true;
                    if (libraryFilter === 'image') return item.type === 'image';
                    if (libraryFilter === 'video') return item.type === 'video';
                    if (libraryFilter === 'lipsync') return item.type === 'lipsync';
                    return false;
                  });
                return filteredList.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group bg-[#111] rounded-3xl border border-[#222] overflow-hidden hover:border-[#d4af37]/50 transition-all shadow-xl"
                  >
                    <div className="aspect-[9/16] relative bg-[#1a1a1a] overflow-hidden cursor-pointer"
                      onClick={() => openPreview(item, filteredList)}
                    >
                      {sessionPreviews[item.id] || item.previewUrl ? (
                        item.type === 'video' || item.type === 'lipsync' ? (
                          <video 
                            src={sessionPreviews[item.id] || item.previewUrl} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            muted 
                            loop 
                            onMouseOver={e => e.currentTarget.play()} 
                            onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          />
                        ) : (
                          <img 
                            src={sessionPreviews[item.id] || item.previewUrl} 
                            alt={item.prompt}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 p-6 text-center">
                          <AlertCircle size={48} className="mb-4 opacity-20" />
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Mídia não sincronizada</p>
                          <p className="text-[8px] mt-2 opacity-30">Esta imagem era muito grande para o banco de dados e foi perdida após o recarregamento.</p>
                        </div>
                      )}
                      
                      {sessionPreviews[item.id] && !item.previewUrl && (
                        <div className="absolute top-4 left-4 bg-blue-500 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg z-20 flex items-center gap-1">
                          <Clock size={10} />
                          SESSÃO LOCAL
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(sessionPreviews[item.id] || item.previewUrl!, item.id);
                            }}
                            className="flex-1 bg-[#d4af37] text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                          >
                            <Download size={18} />
                            BAIXAR
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            className="w-14 h-14 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 size={24} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${item.type === 'video' ? 'bg-blue-500/20 text-blue-400' : item.type === 'lipsync' ? 'bg-pink-500/20 text-pink-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {item.type}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">#{item.id}</span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed italic">"{item.prompt}"</p>
                    </div>
                  </motion.div>
                ));
              })()}
            </div>

            {batch.filter(item => item.status === 'completed' && (libraryFilter === 'all' || item.type === libraryFilter)).length === 0 && (
              <div className="py-20 text-center bg-[#111] rounded-[3rem] border border-[#222] border-dashed">
                <Layers size={64} className="mx-auto mb-6 opacity-10" />
                <h3 className="text-xl font-bold text-gray-500 mb-2">Nenhum item encontrado</h3>
                <p className="text-gray-600">Sua biblioteca está vazia para este filtro.</p>
              </div>
            )}
          </div>
        )}

        {/* --- Profile Tab --- */}
        {activeTab === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto space-y-8 pb-20"
          >
            <div className="bg-[#111] border border-[#222] rounded-[3rem] overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-[#d4af37] to-[#f1c40f] relative">
                <div className="absolute -bottom-12 left-10">
                  <div className="relative group">
                    <img 
                      src={user.photoURL || ''} 
                      alt="Avatar" 
                      className="w-24 h-24 rounded-3xl border-4 border-[#111] bg-gray-800 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                      <Upload size={20} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-16 pb-10 px-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{user.displayName}</h3>
                    <p className="text-gray-500 font-medium">{user.email}</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="px-4 py-2 bg-[#d4af37]/10 text-[#d4af37] text-[10px] font-black rounded-xl uppercase tracking-widest border border-[#d4af37]/20">
                      Plano {userData?.plan || 'Free'}
                    </span>
                    <span className="px-4 py-2 bg-green-500/10 text-green-500 text-[10px] font-black rounded-xl uppercase tracking-widest border border-green-500/20">
                      Conta Verificada
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#111] border border-[#222] rounded-[3rem] p-10 space-y-8">
                <h4 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <User size={20} className="text-[#d4af37]" />
                  Dados Pessoais
                </h4>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome Completo</label>
                    <input 
                      type="text" 
                      defaultValue={user.displayName || ''} 
                      className="w-full bg-[#0a0a0a] border border-[#222] rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-[#d4af37] transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">E-mail de Contato</label>
                    <input 
                      type="email" 
                      defaultValue={user.email || ''} 
                      disabled
                      className="w-full bg-[#0a0a0a] border border-[#222] rounded-2xl px-5 py-4 text-sm font-bold text-gray-600 outline-none cursor-not-allowed"
                    />
                  </div>
                  <button className="w-full py-4 bg-[#d4af37] text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.02] transition-all">
                    Salvar Alterações
                  </button>
                </div>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-[3rem] p-10 space-y-8">
                <h4 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <ShieldCheck size={20} className="text-[#d4af37]" />
                  Segurança e Plano
                </h4>
                <div className="space-y-6">
                  <div className="p-6 bg-[#0a0a0a] border border-[#222] rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Seu Plano Atual</p>
                      <p className="text-lg font-black text-white uppercase tracking-tighter">{userData?.plan || 'Free Trial'}</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('plans')}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Mudar Plano
                    </button>
                  </div>
                  <div className="p-6 bg-[#0a0a0a] border border-[#222] rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Créditos Disponíveis</p>
                      <p className="text-lg font-black text-[#d4af37] uppercase tracking-tighter">{userData?.credits || 0} Créditos</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('plans')}
                      className="px-4 py-2 bg-[#d4af37]/10 text-[#d4af37] text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Recarregar
                    </button>
                  </div>
                  <button className="w-full py-4 border border-red-500/20 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-500/5 transition-all">
                    Excluir Minha Conta
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- Referrals Tab --- */}
        {activeTab === 'referrals' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl mx-auto space-y-8 pb-20"
          >
            {/* Main Banner */}
            <div className="bg-[#d4af37] rounded-[3rem] p-12 md:p-16 relative overflow-hidden shadow-2xl shadow-[#d4af37]/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
              <div className="absolute bottom-0 right-0 opacity-10">
                <Gift size={300} className="text-black -mr-20 -mb-20" />
              </div>
              
              <div className="relative z-10 space-y-6 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black/10 rounded-full border border-black/10">
                  <Gift size={14} className="text-black" />
                  <span className="text-[10px] font-black text-black uppercase tracking-widest">Programa de Indicações</span>
                </div>
                
                <h2 className="text-4xl md:text-6xl font-black text-black uppercase tracking-tighter leading-none">
                  Ganhe 10 Créditos Extras por Indicação
                </h2>
                
                <p className="text-black/70 text-lg font-bold leading-relaxed">
                  Convide seus amigos para o Lumina Art Creator. Quando eles se cadastrarem e adquirirem qualquer plano, você recebe 10 créditos na hora!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Link and Stats */}
              <div className="bg-[#111] border border-[#222] rounded-[3rem] p-10 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Seu Link de Indicação</h3>
                  <div className="flex items-center gap-2 p-2 bg-[#0a0a0a] border border-[#222] rounded-2xl">
                    <input 
                      type="text" 
                      readOnly 
                      value={`https://luminaaisolutions.com.br/?ref=${user.uid.slice(0, 8)}`}
                      className="flex-1 bg-transparent border-none outline-none px-4 text-sm font-bold text-gray-400 truncate"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`https://luminaaisolutions.com.br/?ref=${user.uid.slice(0, 8)}`);
                      }}
                      className="p-4 bg-[#d4af37] text-black rounded-xl hover:scale-105 transition-all shadow-lg shadow-[#d4af37]/20"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className="pt-8 border-t border-[#222] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#d4af37]/10 rounded-xl flex items-center justify-center">
                      <CheckCircle2 size={24} className="text-[#d4af37]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Indicações Ativas</p>
                      <p className="text-2xl font-black text-white">{userData?.referralCount || 0}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Créditos Ganhos</p>
                    <p className="text-2xl font-black text-[#d4af37]">{(userData?.referralCount || 0) * 10}</p>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="bg-[#111] border border-[#222] rounded-[3rem] p-10 space-y-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Como Funciona?</h3>
                
                <div className="space-y-6">
                  {[
                    "Compartilhe seu link exclusivo com amigos e parceiros.",
                    "Seu indicado se cadastra no Lumina Art Creator.",
                    "Assim que ele realizar a primeira compra de créditos ou plano.",
                    "Você recebe automaticamente 10 créditos extras em sua conta."
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-4 group">
                      <div className="w-8 h-8 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center shrink-0 text-[#d4af37] text-xs font-black group-hover:bg-[#d4af37] group-hover:text-black transition-all">
                        {i + 1}
                      </div>
                      <p className="text-sm text-gray-400 font-medium leading-relaxed pt-1">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- FAQ Tab --- */}
        {activeTab === 'faq' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto space-y-8 pb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Como podemos ajudar?</h2>
              <p className="text-gray-500">Encontre respostas rápidas para as dúvidas mais comuns sobre o Lumina.</p>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "Como funcionam os créditos?",
                  a: "Cada geração de imagem ou vídeo consome uma quantidade específica de créditos. Imagens HD consomem 1 crédito, enquanto vídeos e LipSync podem consumir mais dependendo da duração e complexidade."
                },
                {
                  q: "Posso usar as criações comercialmente?",
                  a: "Sim! Todas as criações geradas nos planos pagos (Iniciante, Pro e Elite) possuem licença comercial completa. No plano Free, o uso é restrito a fins não comerciais."
                },
                {
                  q: "O que é o LipSync Studio?",
                  a: "É nossa tecnologia avançada que permite sincronizar o movimento dos lábios de qualquer personagem ou foto com um arquivo de áudio, criando vídeos realistas de fala."
                },
                {
                  q: "Como cancelar minha assinatura?",
                  a: "Você pode cancelar a qualquer momento na aba 'Perfil e Conta' ou 'Planos'. Sua assinatura permanecerá ativa até o final do período já pago."
                },
                {
                  q: "Meus créditos expiram?",
                  a: "Créditos de planos mensais expiram ao final do ciclo. Créditos adquiridos via 'Packs Avulsos' nunca expiram e ficam acumulados em sua conta."
                }
              ].map((item, i) => (
                <div key={i} className="bg-[#111] border border-[#222] rounded-[2rem] overflow-hidden">
                  <button className="w-full p-8 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-all group">
                    <span className="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors">{item.q}</span>
                    <ChevronDown size={20} className="text-gray-600" />
                  </button>
                  <div className="px-8 pb-8 text-gray-500 text-sm leading-relaxed border-t border-[#222]/50 pt-6">
                    {item.a}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-10 bg-[#d4af37] rounded-[3rem] text-black flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Ainda tem dúvidas?</h3>
                <p className="font-bold opacity-70">Nossa equipe de suporte está pronta para te atender.</p>
              </div>
              <div className="flex gap-4">
                <button className="px-8 py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-105 transition-all">
                  Suporte via WhatsApp
                </button>
                <button className="px-8 py-4 bg-white/20 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white/30 transition-all">
                  Enviar E-mail
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- Plans Tab --- */}
        {activeTab === 'plans' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl mx-auto space-y-12 pb-20"
          >
            <div className="text-center space-y-4">
              <h2 className="text-5xl font-black text-white uppercase tracking-tighter">Escolha o Plano Ideal</h2>
              <p className="text-gray-500 text-lg">Potencialize sua criação com créditos ilimitados e recursos exclusivos.</p>
              
              <div className="flex items-center justify-center gap-4 pt-4">
                <span className={`text-xs font-bold uppercase tracking-widest ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-500'}`}>Mensal</span>
                <button 
                  onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                  className="w-14 h-7 bg-[#111] border border-[#222] rounded-full relative p-1 transition-all"
                >
                  <motion.div 
                    animate={{ x: billingCycle === 'monthly' ? 0 : 28 }}
                    className="w-5 h-5 bg-[#d4af37] rounded-full shadow-lg"
                  />
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-widest ${billingCycle === 'yearly' ? 'text-white' : 'text-gray-500'}`}>Anual</span>
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-black rounded uppercase">20% OFF</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  name: 'Iniciante', 
                  credits: 100, 
                  price: billingCycle === 'monthly' ? 47 : 37, 
                  description: 'Ideal para criadores individuais que buscam consistência.',
                  features: ['100 Créditos/mês', 'Geração de Imagens HD', 'Suporte via E-mail', 'Acesso aos Modelos Flash', '1 Marca']
                },
                { 
                  name: 'Creator Pro', 
                  credits: 500, 
                  price: billingCycle === 'monthly' ? 97 : 77, 
                  description: 'A escolha dos profissionais para escala e qualidade máxima.',
                  features: ['500 Créditos/mês', 'Geração de Vídeos e LipSync', 'Suporte Prioritário WhatsApp', 'Acesso ao Gemini 3.1 Pro', 'Marcas Ilimitadas', 'Remoção de Marca d\'água'],
                  popular: true
                },
                { 
                  name: 'Elite Agency', 
                  credits: 2000, 
                  price: billingCycle === 'monthly' ? 297 : 237, 
                  description: 'Potência máxima para agências e grandes operações.',
                  features: ['2000 Créditos/mês', 'Prioridade na Fila de Geração', 'Gerente de Conta Dedicado', 'API Access (Beta)', 'Treinamento de Modelos Custom', 'Colaboração em Equipe']
                }
              ].map((plan, i) => (
                <div 
                  key={i} 
                  className={`relative p-10 rounded-[48px] border transition-all flex flex-col ${plan.popular ? 'bg-[#111] border-[#d4af37] shadow-2xl shadow-[#d4af37]/10' : 'bg-[#111] border-[#222] hover:border-[#333]'}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#d4af37] text-black text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                      Mais Popular
                    </div>
                  )}
                  
                  <div className="mb-8">
                    <h4 className="text-xl font-black text-white uppercase tracking-tight mb-2">{plan.name}</h4>
                    <p className="text-gray-500 text-xs leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">R$ {plan.price}</span>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">/mês</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-[10px] text-green-500 font-bold mt-1">Cobrado anualmente (R$ {plan.price * 12})</p>
                    )}
                  </div>

                  <ul className="space-y-4 mb-10 flex-grow">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm text-gray-300">
                        <div className="w-5 h-5 rounded-full bg-[#d4af37]/10 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={12} className="text-[#d4af37]" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => handlePurchase(plan.name, plan.credits, plan.price)}
                    className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${plan.popular ? 'bg-[#d4af37] text-black hover:scale-105 shadow-lg shadow-[#d4af37]/20' : 'bg-[#1a1a1a] text-white border border-[#222] hover:bg-[#222]'}`}
                  >
                    Assinar Agora
                  </button>
                </div>
              ))}
            </div>

            {/* --- Add-on Credits Section --- */}
            <div className="mt-20 pt-20 border-t border-[#222]">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Precisa de mais fôlego?</h3>
                <p className="text-gray-500">Adquira pacotes de créditos avulsos que nunca expiram.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { name: 'Pack 100', credits: 100, price: 49 },
                  { name: 'Pack 500', credits: 500, price: 197 },
                  { name: 'Pack 1000', credits: 1000, price: 347 }
                ].map((pack, i) => (
                  <div key={i} className="bg-[#111] border border-[#222] p-8 rounded-[32px] hover:border-[#d4af37]/50 transition-all group">
                    <div className="w-12 h-12 bg-[#d4af37]/10 text-[#d4af37] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Zap size={24} />
                    </div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight mb-1">{pack.name}</h4>
                    <p className="text-2xl font-black text-[#d4af37] mb-4">{pack.credits} <span className="text-xs text-gray-500 font-bold uppercase tracking-widest text-[10px]">Créditos</span></p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-xl font-black text-white">R$ {pack.price}</span>
                    </div>
                    <button 
                      onClick={() => handlePurchase(pack.name, pack.credits, pack.price)}
                      className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                    >
                      Comprar Agora
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#111] p-8 rounded-[40px] border border-[#222] space-y-6">
                <h3 className="font-black text-lg text-white uppercase tracking-tight flex items-center gap-3">
                  <ShieldCheck size={20} className="text-[#d4af37]" />
                  Segurança e Pagamento
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Utilizamos criptografia de ponta a ponta. Seus pagamentos são processados com segurança via Stripe ou Mercado Pago. Cancelamento fácil a qualquer momento.
                </p>
              </div>

              {userData?.role === 'admin' && (
                <div className="bg-[#111] p-8 rounded-[40px] border border-[#222] space-y-6">
                  <h3 className="font-black text-lg text-white uppercase tracking-tight flex items-center gap-3">
                    <Settings size={20} className="text-[#d4af37]" />
                    Configurações Técnicas
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={async () => await (window as any).aistudio?.openSelectKey()}
                      className="bg-[#1a1a1a] text-white font-bold py-4 px-4 rounded-2xl hover:bg-[#222] transition-all flex items-center justify-center gap-2 border border-[#222] text-[10px] uppercase tracking-widest"
                    >
                      <Settings size={16} />
                      Chave de API
                    </button>
                    <button 
                      onClick={runDiagnostics}
                      className="bg-[#1a1a1a] text-white font-bold py-4 px-4 rounded-2xl hover:bg-[#222] transition-all border border-[#222] text-[10px] uppercase tracking-widest"
                    >
                      Diagnóstico
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-12"
            onClick={() => setSelectedMedia(null)}
          >
            {/* Action Buttons */}
            <div className="absolute top-6 right-6 flex items-center gap-3 z-[120]">
              <motion.button
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedMedia.url, selectedMedia.id || 'preview');
                }}
                title="Download"
              >
                <Download size={20} />
              </motion.button>

              {selectedMedia.id && (
                <motion.button
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-3 bg-red-500/10 hover:bg-red-500/20 rounded-full text-red-500 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Tem certeza que deseja excluir esta arte?')) {
                      handleDelete(selectedMedia.id!);
                      setSelectedMedia(null);
                    }
                  }}
                  title="Excluir"
                >
                  <Trash2 size={20} />
                </motion.button>
              )}

              <motion.button
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMedia(null);
                }}
                title="Fechar"
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* Carousel Navigation */}
            {selectedMedia.list && selectedMedia.list.length > 1 && selectedMedia.index !== undefined && (
              <>
                {selectedMedia.index > 0 && (
                  <button
                    className="absolute left-6 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[110] hover:scale-110"
                    onClick={(e) => navigatePreview('prev', e)}
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                {selectedMedia.index < selectedMedia.list.length - 1 && (
                  <button
                    className="absolute right-6 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[110] hover:scale-110"
                    onClick={(e) => navigatePreview('next', e)}
                  >
                    <ChevronRight size={24} />
                  </button>
                )}
              </>
            )}
            
            <div 
              className="relative max-w-full max-h-full flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedMedia.type === 'video' ? (
                <motion.video
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={selectedMedia.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <motion.img
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={selectedMedia.url}
                  alt="Expanded view"
                  className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                  referrerPolicy="no-referrer"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Processing Overlay Removed --- */}
    </div>
  );
}
