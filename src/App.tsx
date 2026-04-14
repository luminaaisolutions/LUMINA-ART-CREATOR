/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { LandingPage } from './components/LandingPage';

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
  getDownloadURL
} from './firebase';

// --- Types ---
interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
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

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastSentCode, setLastSentCode] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState('');

  // --- Referral Check ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referredBy', ref);
    }
  }, []);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'branding' | 'projects' | 'creative_studio' | 'lipsync' | 'library' | 'plans'>('dashboard');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'image' | 'video'>('all');
  const [dragActive, setDragActive] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  
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
  const [creativeColors, setCreativeColors] = useState<string[]>([]);
  const [creativeTypography, setCreativeTypography] = useState('Modern');
  const [creativeFormat, setCreativeFormat] = useState('Instagram Post 1:1');
  const [creativeQuantity, setCreativeQuantity] = useState(1);
  const [creativePrompt, setCreativePrompt] = useState('');
  const [creativeStrategy, setCreativeStrategy] = useState('Oferta Direta');
  const [creativeAesthetic, setCreativeAesthetic] = useState('Minimalista');
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
    description?: string
  }[]>([]);
  const [activeBrandProfileId, setActiveBrandProfileId] = useState<string | null>(null);
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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refAssetInputRef = useRef<HTMLInputElement | null>(null);
  const productAssetInputRef = useRef<HTMLInputElement | null>(null);
  const lipsyncAssetInputRef = useRef<HTMLInputElement | null>(null);
  const lipsyncProductAssetInputRef = useRef<HTMLInputElement | null>(null);
  const creativeLogoInputRef = useRef<HTMLInputElement | null>(null);
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

  const getAI = () => {
    const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    const key = rawKey.trim().replace(/['"]/g, '');
    if (key) {
      console.log("Gemini API Key carregada:", key.substring(0, 4) + "..." + key.substring(key.length - 4));
    } else {
      console.warn("Gemini API Key está vazia!");
    }
    return new GoogleGenAI({ apiKey: key });
  };

  const callGeminiAPI = async (options: { prompt?: string, contents?: any, model?: string, config?: any }) => {
    try {
      const { prompt, contents, model = "gemini-3-flash-preview", config } = options;
      
      const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!key) {
        throw new Error("GEMINI_API_KEY não configurada. Adicione-a nas configurações do seu projeto no Vercel Dashboard.");
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: model === "gemini-1.5-flash" ? "gemini-3-flash-preview" : model,
        contents: contents || [{ role: 'user', parts: [{ text: prompt || "" }] }],
        config
      });
      
      return response;
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "Failed to call Gemini API");
    }
  };

  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [brandStep, setBrandStep] = useState<'list' | 'upload' | 'info' | 'referral' | 'faq'>('list');

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
      setIsAuthReady(true);

      // Check if domain is authorized (hint for production setup)
      const currentDomain = window.location.hostname;
      if (currentDomain !== 'localhost' && 
          !currentDomain.includes('run.app') && 
          !currentDomain.includes('firebaseapp.com') &&
          !currentDomain.includes('web.app') &&
          currentDomain !== 'luminaaisolutions.com.br') {
        console.warn(`Atenção: O domínio ${currentDomain} pode não estar autorizado no Firebase Auth.`);
      }
      
      if (currentUser) {
        // Sync user profile
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Listen for user data changes (credits, plan)
        const unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as any);
          } else {
            // New user initialization
            const refCode = Math.random().toString(36).substring(2, 9);
            const referredBy = localStorage.getItem('referredBy') || null;
            
            const initialData = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: currentUser.email === 'luminaaisolutions@gmail.com' ? 'admin' : 'user',
              credits: 50, // 50 free credits for new users
              plan: 'free',
              createdAt: new Date(),
              isVerified: false,
              referralCode: refCode,
              referredBy: referredBy,
              referralCount: 0
            };
            setDoc(userRef, initialData).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`));
            setUserData(initialData as any);
            
            // If referred, we could give bonus here, but user requested "on purchase"
            // For now, just clear the ref
            localStorage.removeItem('referredBy');
          }
        });

        // Sync batch items
        const batchQuery = query(
          collection(db, `users/${currentUser.uid}/batches`),
          orderBy('createdAt', 'desc')
        );
        
        const unsubBatch = onSnapshot(batchQuery, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BatchItem));
          setBatch(items);
        }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${currentUser.uid}/batches`));

        return () => unsubBatch();
      } else {
        setBatch([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePurchase = async (planName: string, credits: number) => {
    if (!user || !userData) return;
    
    try {
      // 1. Update current user's plan and credits
      await updateDoc(doc(db, 'users', user.uid), {
        plan: planName.toLowerCase(),
        credits: increment(credits)
      });
      
      // 2. Check for referrer and give bonus
      if (userData.referredBy) {
        // Find the referrer user
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('referralCode', '==', userData.referredBy));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const referrerDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'users', referrerDoc.id), {
            credits: increment(10), // 10 credits bonus
            referralCount: increment(1)
          });
          console.log("Referral bonus granted to:", referrerDoc.id);
        }
      }
      
      alert(`Parabéns! Você agora é ${planName}. ${credits} créditos foram adicionados à sua conta.`);
    } catch (error) {
      console.error("Purchase failed:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("ERRO DE AUTENTICAÇÃO: Este domínio não está autorizado no seu projeto Firebase. \n\nPor favor, acesse o Console do Firebase > Authentication > Settings > Authorized Domains e adicione 'luminaaisolutions.com.br'.");
      } else {
        alert(`Erro ao entrar: ${error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSessionPreviews({});
      setShowUserMenu(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sendOTP = async () => {
    if (!user || !userData) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      await updateDoc(doc(db, 'users', user.uid), { verificationCode: code });
      
      await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code })
      });
      
      alert(`Um código de verificação foi enviado para ${user.email}. (Para teste: ${code})`);
      setLastSentCode(code);
    } catch (error) {
      console.error("Failed to send OTP:", error);
    }
  };

  const verifyOTP = async () => {
    if (!user || !userData) return;
    const enteredCode = verificationCode.join('');
    
    // Allow bypass for development if needed, but here we check against DB
    if (enteredCode === userData.verificationCode || (lastSentCode && enteredCode === lastSentCode)) {
      setIsVerifying(true);
      try {
        await updateDoc(doc(db, 'users', user.uid), { 
          isVerified: true,
          verificationCode: deleteField() 
        });
      } catch (error) {
        console.error("Verification failed:", error);
      } finally {
        setIsVerifying(false);
      }
    } else {
      alert("Código incorreto. Tente novamente.");
      setVerificationCode(['', '', '', '', '', '']);
    }
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
        setBrandProfiles(prev => prev.map(b => b.id === activeBrandProfileId ? { ...b, logo } : b));
      }
      
      analyzeLogoColors(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const analyzeLogoColors = async (base64: string, mimeType: string) => {
    setIsAnalyzingLogo(true);
    try {
      const response = await callGeminiAPI({
        model: "gemini-1.5-flash",
        contents: [
          { text: "Analise esta logomarca e identifique as 3 cores principais em formato HEX (ex: #FF0000). Retorne APENAS os códigos HEX separados por vírgula, sem explicações." },
          { inlineData: { data: base64, mimeType } }
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

  const handleMagicPrompt = async () => {
    if (!prompt || isMagicLoading) return;
    setIsMagicLoading(true);
    try {
      const response = await callGeminiAPI({
        model: "gemini-1.5-flash",
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
  const getCostPerItem = (isLipsyncMode = useLipsync) => {
    let baseCost = 1;
    let currentRes = resolution;
    let currentLowPri = lowPriority;
    
    if (isLipsyncMode) {
      baseCost = lipsyncDuration === 8 ? 30 : 15;
      currentRes = lipsyncResolution;
      currentLowPri = lipsyncLowPriority;
    } else if (type === 'video') {
      baseCost = videoDuration >= 8 ? 20 : 10;
      currentRes = resolution;
      currentLowPri = lowPriority;
    } else {
      baseCost = 2; // Base image cost increased slightly for better balancing
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

    // Low Priority Discount (50% off)
    if (currentLowPri) {
      finalCost = Math.ceil(finalCost * 0.5);
    }

    return finalCost;
  };

  const handleCreate = async (e: React.FormEvent, forceLipsync?: boolean, forceCreative?: boolean) => {
    e.preventDefault();
    if (!user || !userData) return;

    const isLipsyncActive = forceLipsync !== undefined ? forceLipsync : (activeTab === 'lipsync' || useLipsync);
    const isCreativeActive = forceCreative !== undefined ? forceCreative : (activeTab === 'projects' || useCreativeStudio);
    
    const costPerItem = getCostPerItem(isLipsyncActive);
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
        alert("Por favor, descreva o que deseja no criativo.");
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
      alert(`Saldo insuficiente! Esta operação custa ${totalCost} créditos, mas você possui apenas ${userData.credits}.`);
      setActiveTab('plans');
      return;
    }

    // Check for API key if using image models
    if (type === 'image' || type === 'video' || isLipsyncActive || isCreativeActive) {
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio?.openSelectKey();
      }
    }

    // Validation for Lipsync
    if (isLipsyncActive && !lipsyncAsset) {
      alert("Para usar o Lip Sync, você precisa fazer o upload de um Ator/Referência.");
      return;
    }
    if (isLipsyncActive && !lipsyncAudio && lipsyncAudioPrompt.trim() === '') {
      alert("Para usar o Lip Sync, você precisa fazer o upload de um arquivo de Áudio ou escrever um Prompt de Áudio.");
      return;
    }
    
    // Validation for Estúdio Lumina
    if (isCreativeActive && !creativeLogo) {
      alert("Para gerar criativos, você precisa subir a logomarca.");
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
    const currentRefAsset = refAsset;
    const currentProductAsset = productAsset;
    const currentLipsyncAsset = lipsyncAsset;
    const currentLipsyncProductAsset = lipsyncProductAsset;
    const currentModelType = modelType;
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
    
    // Deduct credits immediately
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { credits: userData.credits - totalCost }).catch(err => {
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
          sourceTab: activeTab,
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
              [CREATIVE STUDIO MODE ACTIVE - WORLD CLASS SOCIAL MEDIA STANDARDS]
              STRATEGY: ${currentCreativeStrategy}
              AESTHETIC: ${currentCreativeAesthetic}
              FORMAT: ${currentCreativeFormat}
              TYPOGRAPHY STYLE: ${currentCreativeTypography}
              BRAND COLORS: ${currentCreativeColors.join(', ')}
              LOGO: A brand logo is provided. Integrate the brand identity seamlessly into the creative.
              GOAL: Create a high-converting, professional marketing asset for social media using the specified strategy and aesthetic.
              BEST PRACTICES: Use high-contrast lighting, clean compositions, rule of thirds, and vibrant colors that pop on mobile feeds. 
              Ensure the brand identity feels native to the platform (Instagram, TikTok, etc.).
              ` : '';

              const enhancerRes = await callGeminiAPI({
                model: 'gemini-1.5-flash',
                prompt: `Enhance this prompt for professional and creative AI image generation: "${itemPrompt}". 
                ${creativeContext}
                ${hasRef ? 'CRITICAL: The user provided a persona reference image. You MUST maintain 100% facial features and identity. The persona MUST remain identical.' : ''}
                ${hasProduct ? 'CRITICAL: The user provided a product reference image. The persona MUST be presenting/holding this EXACT product.' : ''}
                Your goal is to be highly efficient, seeking rich references, intricate details, and novelties in the composition. 
                Focus on cinematic lighting, hyper-realistic textures, and unique artistic perspectives while keeping the person and product identical.
                IMPORTANT: If this is part of a batch, ensure this specific variation is visually distinct from any other possible interpretation of the theme.
                Output ONLY the enhanced prompt in English.`
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
              if (currentModelType === 'imagen') {
                let promptText = currentRefAsset && currentRefAsset.type === 'image' 
                  ? `EXACT PERSONA FIDELITY. DO NOT CHANGE FACE. MAINTAIN IDENTITY. ${enhancedPrompt}`
                  : enhancedPrompt;

                if (currentUseCreativeStudio) {
                  promptText = `[CREATIVE AD MODE] BRAND COLORS: ${currentCreativeColors.join(', ')}. STYLE: ${currentCreativeTypography}. FORMAT: ${currentCreativeFormat}. ${promptText}`;
                }

                const response = await callGeminiAPI({
                  model: 'imagen-4.0-generate-001', 
                  prompt: promptText,
                  config: {
                    numberOfImages: 1,
                    aspectRatio: currentAspectRatio as any,
                  }
                });
                
                // @ts-ignore
                base64Data = response.generatedImages?.[0]?.image?.imageBytes;
              } else {
                const isHighRes = currentResolution === '2K' || currentResolution === '4K';
                const modelName = 'gemini-1.5-flash'; 
                
                const parts: any[] = [{ text: enhancedPrompt }];
                if (currentRefAsset && currentRefAsset.type === 'image') {
                  parts.push({
                    inlineData: {
                      data: currentRefAsset.data,
                      mimeType: currentRefAsset.mimeType
                    }
                  });
                  // Extremely strong instruction for persona fidelity
                  parts[0].text = `[SYSTEM: PERSONA PRESERVATION MODE]
                  ACT AS A MASTER PORTRAIT ARTIST. 
                  REFERENCE IMAGE ATTACHED. 
                  TASK: Generate a new image based on the prompt while maintaining 100% IDENTITY FIDELITY.
                  DO NOT ALTER: Face shape, eyes, nose, lips, skin tone, hair texture, or unique features.
                  THE PERSON IN THE GENERATED IMAGE MUST BE THE EXACT SAME INDIVIDUAL AS IN THE REFERENCE.
                  PROMPT: ${enhancedPrompt}`;
                }

                if (currentProductAsset && currentProductAsset.type === 'image') {
                  parts.push({
                    inlineData: {
                      data: currentProductAsset.data,
                      mimeType: currentProductAsset.mimeType
                    }
                  });
                  parts[0].text += `\n[SYSTEM: PRODUCT INTEGRATION]
                  PRODUCT IMAGE ATTACHED. 
                  TASK: The persona MUST be presenting the product shown in the reference image. 
                  The product must look exactly as shown. The persona should hold or interact with the product naturally.`;
                }

                if (currentUseCreativeStudio && currentCreativeLogo) {
                  parts.push({
                    inlineData: {
                      data: currentCreativeLogo.data,
                      mimeType: currentCreativeLogo.mimeType
                    }
                  });
                  parts[0].text += `\n[SYSTEM: BRAND INTEGRATION]
                  LOGO ATTACHED. 
                  TASK: Integrate this logo and the brand colors (${currentCreativeColors.join(', ')}) into the creative. 
                  The typography should follow a ${currentCreativeTypography} style. 
                  The final image MUST be a professional ${currentCreativeFormat}.`;
                }

                const response = await callGeminiAPI({
                  model: modelName,
                  contents: [{ role: 'user', parts }],
                  config: {
                    tools: currentUseGrounding ? [{ googleSearch: {} }] : undefined,
                    imageConfig: {
                      aspectRatio: currentAspectRatio as any,
                      ...(isHighRes ? { imageSize: currentResolution as any } : {})
                    },
                    safetySettings: [
                      { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                      { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
                    ],
                    temperature: 0.4, // Lower temperature for better persona consistency
                    topP: 0.8,
                    topK: 40
                  }
                });
                
                // Find the image part in the response candidates
                const responseParts = response.candidates?.[0]?.content?.parts;
                if (responseParts) {
                  const imagePart = responseParts.find((p: any) => p.inlineData);
                  if (imagePart) {
                    base64Data = imagePart.inlineData.data;
                    mimeType = imagePart.inlineData.mimeType || 'image/png';
                  }
                }
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
          if (!fastMode && isLipsync && currentLipsyncAudio) {
            try {
              const analysisRes = await callGeminiAPI({
                model: 'gemini-1.5-flash',
                contents: [{
                  role: 'user',
                  parts: [
                    { text: `Analyze this audio and enhance the visual prompt. 
                    1. Is this audio music/singing? (YES/NO)
                    2. What is the language being spoken? (e.g., Portuguese, English, Spanish, etc.)
                    3. Enhance this visual prompt for Veo 3.1: "${itemPrompt}". 
                    CRITICAL: Focus ONLY on visual details, lighting, and cinematic quality. 
                    DO NOT describe the speech content or language in the enhanced prompt. 
                    DO NOT suggest scene changes or multiple shots.
                    Respond in JSON: { "isMusic": true/false, "language": "...", "enhancedPrompt": "..." }` },
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
            enhancedPrompt = `[LIP SYNC MODE - STRICT PORTUGUESE]
            CONTENT: The character MUST speak EXACTLY: "${currentLipsyncAudioPrompt || 'Bom dia'}".
            LANGUAGE: Portuguese (PT-BR). NO TRANSLATION. NO ENGLISH.
            VISUALS: Maintain 100% identity of the person in the reference image. 
            THE PERSON MUST BE EXACTLY THE SAME AS IN THE REFERENCE IMAGE.
            ${hasProductRef ? 'PRODUCT: The character MUST be presenting the product shown in the product reference image.' : ''}
            SYNC: Perfect mouth synchronization with the ${isAudioGenerated ? 'generated' : 'attached'} audio.
            STRICT: No hallucinations. No new words. No body motion. Absolute silence in generated video.`;
          } else if (hasProductRef) {
            enhancedPrompt = `[PRODUCT PRESENTATION MODE]
            VISUALS: Maintain 100% identity of the person in the reference image.
            PRODUCT: The character MUST be presenting the product shown in the product reference image.
            ACTION: ${itemPrompt}`;
          }

          await updateDoc(doc(db, itemPath), { progress: 30, status: 'processing' });

          // 3. Generate Video
          // CRITICAL: Lip Sync REQUIRES veo-3.1-lite-generate-preview
          // Multiple References REQUIRES veo-3.1-generate-preview
          // If both are present, we MUST prioritize Lip Sync (lite model) and use a single image ref
          const isLipsyncJob = isLipsync;
          const modelToUse = isLipsyncJob ? 'veo-3.1-lite-generate-preview' : (hasProductRef ? 'veo-3.1-generate-preview' : 'veo-3.1-lite-generate-preview');
          
          const videoParams: any = {
            model: modelToUse,
            prompt: enhancedPrompt,
            config: {
              numberOfVideos: 1,
              resolution: (modelToUse === 'veo-3.1-generate-preview' || hasProductRef) ? '720p' : (currentResolution === '1080p' ? '1080p' : '720p'),
              aspectRatio: (modelToUse === 'veo-3.1-generate-preview' || hasProductRef) ? '16:9' : (currentAspectRatio === '16:9' || currentAspectRatio === '9:16' ? currentAspectRatio : '9:16'),
              durationSeconds: Math.max(4, Math.min(8, Math.round(Number(currentVideoDuration) || 4)))
            }
          };

          if (modelToUse === 'veo-3.1-generate-preview') {
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
            videoParams.config.referenceImages = referenceImages;
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

          const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
          if (!key) {
            throw new Error("GEMINI_API_KEY não configurada para geração de vídeo.");
          }

          // Use SDK directly for video generation
          const ai = getAI();
          // @ts-ignore
          let operation = await ai.models.generateVideos({
            model: videoParams.model === 'veo-3.1-lite-generate-preview' ? 'veo-3.1-lite-generate-preview' : 'veo-3.1-generate-preview',
            prompt: videoParams.prompt,
            config: {
              ...videoParams.config,
              numberOfVideos: 1
            },
            image: videoParams.image,
            // @ts-ignore
            audio_input: videoParams.audio_input
          });

          // 3. Polling
          let pollCount = 0;
          while (!operation.done) {
            pollCount++;
            const pollProgress = Math.min(30 + (pollCount * 10), 90);
            await updateDoc(doc(db, itemPath), { progress: pollProgress });
            
            await new Promise(resolve => setTimeout(resolve, 10000));
            // @ts-ignore
            operation = await ai.operations.getVideosOperation({ operation });
          }

          if (operation.error) {
            throw new Error(String(operation.error.message || "Erro na geração do vídeo."));
          }

          // 4. Handle result
          const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
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
          await updateDoc(userRef, { credits: userData.credits + costPerItem });
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
              model: 'gemini-1.5-flash',
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
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const extension = blob.type.includes('video') ? 'mp4' : 'png';
      link.download = `geracao-${id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback: open in new tab
      window.open(url, '_blank');
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
    if (!refAsset) return;
    setIsAnalyzing(true);
    try {
      const response = await callGeminiAPI({
        model: "gemini-1.5-flash",
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
        model: "gemini-1.5-flash",
        prompt: `Enhance this video/image prompt to be more cinematic, detailed, and professional for Veo 3.1: "${prompt}". Focus on lighting, camera angles, textures, and atmosphere. Respond ONLY with the enhanced prompt in English.`
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
      setPrompt(prev => {
        const current = prev.trim();
        if (!current) return styles[style];
        if (current.includes(styles[style])) return current;
        return `${current}, ${styles[style]}`;
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
        model: "gemini-1.5-flash",
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

  if (!user) {
    return <LandingPage onLogin={handleLogin} />;
  }

  if (userData && !userData.isVerified) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8 text-center"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">Verifique seu email</h1>
            <p className="text-gray-400">Digite o código de 6 dígitos que enviamos</p>
          </div>

          <div className="bg-[#111] p-8 rounded-[32px] border border-[#222] space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Código enviado para</p>
              <p className="font-bold text-[#d4af37]">{user.email}</p>
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
                  onClick={sendOTP}
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
                
                <button 
                  onClick={async () => {
                    if (user) {
                      await updateDoc(doc(db, 'users', user.uid), { isVerified: true });
                    }
                  }}
                  className="text-[8px] font-black text-gray-700 hover:text-gray-500 transition-colors uppercase tracking-widest mt-4"
                >
                  Pular Verificação (Desenvolvimento)
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
      {/* --- Top Navigation --- */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#111] border-b border-[#222] z-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d4af37] to-[#f1c40f] rounded-xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
              <Zap className="text-black w-6 h-6" />
            </div>
            <span className="hidden lg:block font-bold text-xl tracking-tighter text-white uppercase">LUMINA <span className="text-[#d4af37]">ART CREATOR</span></span>
          </div>

          <nav className="flex items-center gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'branding', label: 'Perfis de Marca', icon: Palette },
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
                <span className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest leading-none mb-1">Créditos</span>
                <span className="text-sm font-black text-white leading-none">{userData.credits || 0}</span>
              </div>
              <div className="w-px h-6 bg-[#222]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Plano</span>
                <span className="text-xs font-bold text-white leading-none">{userData.plan}</span>
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
                          <span className="text-xs font-bold text-gray-300">Créditos</span>
                        </div>
                        <div className="flex items-center gap-1 bg-[#d4af37]/10 px-2 py-1 rounded-lg">
                          <Sparkles size={10} className="text-[#d4af37]" />
                          <span className="text-[10px] font-black text-[#d4af37]">{userData?.credits || 0}</span>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('branding'); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 p-4 hover:bg-[#1a1a1a] rounded-2xl transition-all group text-left"
                      >
                        <Settings size={18} className="text-gray-500 group-hover:text-[#d4af37]" />
                        <span className="text-xs font-bold text-gray-300">Perfil</span>
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
              {activeTab === 'branding' && 'Perfis de Marca'}
              {activeTab === 'projects' && 'Projetos Criativos Ads'}
              {activeTab === 'creative_studio' && 'Estúdio Lumina'}
            {activeTab === 'lipsync' && 'LipSync Studio'}
            {activeTab === 'library' && 'Sua Biblioteca'}
            {activeTab === 'plans' && 'Planos e Assinaturas'}
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            {activeTab === 'dashboard' && 'Visão geral de todas as funções principais do Lumina.'}
            {activeTab === 'branding' && 'Defina a identidade visual, cores e tipografia de seus clientes.'}
            {activeTab === 'projects' && 'Gere artes e criativos profissionais para marcas específicas.'}
            {activeTab === 'creative_studio' && 'Crie vídeos, imagens, avatares e retratos artísticos com IA.'}
            {activeTab === 'lipsync' && 'Sincronismo labial de alta fidelidade para seus vídeos.'}
            {activeTab === 'library' && 'Acesse todas as suas criações em um só lugar.'}
            {activeTab === 'plans' && 'Gerencie seus planos, créditos e configurações técnicas.'}
          </p>
          </div>
        </header>

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
              {[
                { 
                  id: 'branding', 
                  title: 'Perfis de Marca', 
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
                  className={`group relative bg-[#111] rounded-[40px] border border-[#222] p-8 overflow-hidden transition-all ${card.borderColor} cursor-pointer`}
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
                      <span className="text-[10px] font-black text-[#d4af37] uppercase tracking-[0.2em]">{card.id}</span>
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
                    onClick={() => {
                      const url = sessionPreviews[item.id] || item.previewUrl;
                      if (url) setSelectedMedia({ url, type: item.type === 'image' ? 'image' : 'video' });
                    }}
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
                        onClick={() => {
                          const url = sessionPreviews[item.id] || item.previewUrl;
                          if (url) setSelectedMedia({ url, type: item.type === 'image' ? 'image' : 'video' });
                        }}
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
                              onClick={() => handleDownload(sessionPreviews[item.id] || item.previewUrl!, item.id)} 
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
                { id: 'list', label: 'Meus Perfis', icon: Briefcase },
                { id: 'referral', label: 'Indicações', icon: Gift },
                { id: 'faq', label: 'FAQ', icon: HelpCircle },
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
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Perfis de Marca</h2>
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
                      description: ''
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
                      description: ''
                    });
                    setBrandStep('upload');
                  }}
                >
                  <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center group-hover:bg-[#d4af37] group-hover:text-black transition-all">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg text-white">Nova Marca</h3>
                    <p className="text-gray-500 text-xs">Adicione um novo perfil de cliente</p>
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
                          onClick={() => setBrandProfiles(brandProfiles.filter(b => b.id !== brand.id))}
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
                        Editar Perfil
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
                                reader.onload = (event: any) => {
                                  const base64 = event.target.result.split(',')[1];
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
                                reader.onload = (event: any) => {
                                  const base64 = event.target.result.split(',')[1];
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

                <div className="mt-10 flex justify-end">
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
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipografia Preferida</label>
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
                </div>

                <div className="mt-10 flex justify-end gap-4">
                  <button 
                    onClick={() => {
                      const existingIdx = brandProfiles.findIndex(b => b.id === editingBrand.id);
                      if (existingIdx >= 0) {
                        const newProfiles = [...brandProfiles];
                        newProfiles[existingIdx] = editingBrand;
                        setBrandProfiles(newProfiles);
                      } else {
                        setBrandProfiles([...brandProfiles, editingBrand]);
                      }
                      setBrandStep('list');
                      setEditingBrand(null);
                    }}
                    disabled={!editingBrand.name}
                    className="px-10 py-4 bg-gradient-to-r from-[#d4af37] to-[#f1c40f] text-black font-black rounded-2xl hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    SALVAR PERFIL DE MARCA
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {brandStep === 'referral' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="bg-gradient-to-br from-[#d4af37] to-[#f1c40f] p-10 rounded-[40px] text-black relative overflow-hidden">
                  <div className="relative z-10 space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/10 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <Gift size={14} />
                      Programa de Indicações
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter leading-none">GANHE 10 CRÉDITOS EXTRAS POR INDICAÇÃO</h2>
                    <p className="text-black/70 font-bold text-lg max-w-xl">
                      Convide seus amigos para o Lumina Art Creator. Quando eles se cadastrarem e adquirirem qualquer plano, você recebe 10 créditos na hora!
                    </p>
                  </div>
                  <Gift size={200} className="absolute -bottom-10 -right-10 text-black/5 rotate-12" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-[#111] border border-[#222] p-8 rounded-[40px] space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Seu Link de Indicação</h3>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-[#1a1a1a] border border-[#222] px-4 py-4 rounded-2xl text-sm font-mono text-gray-300 truncate">
                          {`${window.location.origin}?ref=${userData?.referralCode}`}
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}?ref=${userData?.referralCode}`);
                            alert("Link copiado!");
                          }}
                          className="p-4 bg-[#d4af37] text-black rounded-2xl hover:scale-105 transition-all"
                        >
                          <Copy size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#222] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center border border-[#222]">
                          <CheckCircle2 size={20} className="text-[#d4af37]" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Indicações Ativas</p>
                          <p className="text-xl font-black text-white">{userData?.referralCount || 0}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Créditos Ganhos</p>
                        <p className="text-xl font-black text-[#d4af37]">{(userData?.referralCount || 0) * 10}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111] border border-[#222] p-8 rounded-[40px] space-y-6 flex flex-col justify-center">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Como funciona?</h3>
                    <ul className="space-y-4">
                      {[
                        "Compartilhe seu link exclusivo com amigos e parceiros.",
                        "Seu indicado se cadastra no Lumina Art Creator.",
                        "Assim que ele realizar a primeira compra de créditos ou plano.",
                        "Você recebe automaticamente 10 créditos extras em sua conta."
                      ].map((step, i) => (
                        <li key={i} className="flex gap-4 items-start">
                          <span className="w-6 h-6 rounded-full bg-[#d4af37]/10 text-[#d4af37] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm text-gray-400 leading-relaxed">{step}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {brandStep === 'faq' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="text-center space-y-4 mb-12">
                  <h2 className="text-5xl font-black text-white uppercase tracking-tighter">Perguntas Frequentes</h2>
                  <p className="text-gray-500 text-lg">Tudo o que você precisa saber sobre o Lumina Art Creator.</p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      q: "Como funcionam os créditos?",
                      a: "Cada geração de imagem consome 1 crédito. Vídeos e Lip Sync consomem 5 créditos por geração. Se uma geração falhar, seus créditos são estornados automaticamente."
                    },
                    {
                      q: "Posso usar as imagens para fins comerciais?",
                      a: "Sim! Todas as imagens e vídeos gerados no Lumina Art Creator pertencem a você e podem ser usados livremente em suas campanhas de marketing e redes sociais."
                    },
                    {
                      q: "O que é o Perfil de Marca?",
                      a: "É uma funcionalidade exclusiva onde você treina a IA com a identidade visual da sua empresa (logos, cores, tipografia) para que todos os anúncios gerados sigam o mesmo padrão visual."
                    },
                    {
                      q: "Como funciona o sistema de indicações?",
                      a: "Você possui um link único em seu perfil. Cada pessoa que se cadastrar por ele e realizar uma compra ativa garante 10 créditos extras para você, sem limites!"
                    },
                    {
                      q: "Quais são os modelos de IA utilizados?",
                      a: "Utilizamos os modelos mais avançados do mercado, incluindo Gemini 1.5 Pro e Flash, além de modelos especializados em geração de imagem e vídeo de alta fidelidade."
                    },
                    {
                      q: "Como entrar em contato com o suporte?",
                      a: "Você pode nos contatar através do e-mail suporte@luminaaisolutions.com.br ou pelo nosso canal oficial no WhatsApp disponível para assinantes Pro e Elite."
                    }
                  ].map((item, i) => (
                    <div 
                      key={i}
                      className={`bg-[#111] border ${faqOpen === i ? 'border-[#d4af37] bg-[#1a1a1a]' : 'border-[#222]'} rounded-3xl overflow-hidden transition-all`}
                    >
                      <button 
                        onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                        className="w-full p-6 flex items-center justify-between text-left group"
                      >
                        <span className={`font-bold transition-colors ${faqOpen === i ? 'text-[#d4af37]' : 'text-white group-hover:text-[#d4af37]'}`}>{item.q}</span>
                        {faqOpen === i ? <ChevronUp size={20} className="text-[#d4af37]" /> : <ChevronDown size={20} className="text-gray-500" />}
                      </button>
                      <AnimatePresence>
                        {faqOpen === i && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-6 pb-6"
                          >
                            <p className="text-gray-400 text-sm leading-relaxed border-t border-[#222] pt-4">
                              {item.a}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
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
                                <span className="text-[8px] font-bold text-left leading-tight uppercase tracking-wider">{mode.label}</span>
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
                              className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black transition-all border ${fastMode ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1a1a1a] text-gray-500 border-[#222] hover:border-[#333]'}`}
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
                              <span className="text-[9px] font-black uppercase tracking-widest">Vídeo Veo 3.1</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => setType('image')}
                              className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${type === 'image' ? 'border-[#d4af37] bg-[#d4af37]/5 text-[#d4af37]' : 'border-[#222] bg-[#1a1a1a] text-gray-500 hover:border-[#333]'}`}
                            >
                              <ImageIcon size={20} />
                              <span className="text-[9px] font-black uppercase tracking-widest">Imagem Pro</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Middle Column: Assets and Prompt */}
                      <div className="flex-[2] min-w-[400px] space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ator / Referência</label>
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
                                  <span className="text-[8px] font-bold text-gray-500 uppercase">Ator</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Produto</label>
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
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">Estilos</span>
                            </div>
                            <button
                              type="button"
                              onClick={enhancePromptWithAI}
                              disabled={isEnhancing || !prompt.trim()}
                              className="bg-[#d4af37] text-black px-2 py-1 rounded-lg font-black text-[8px] flex items-center gap-1 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
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
                              ].map((style) => (
                                <button
                                  key={style.id}
                                  type="button"
                                  onClick={() => applyStyle(style.id)}
                                  className="bg-black/20 border border-white/5 hover:border-[#d4af37]/50 p-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-all group"
                                >
                                  <style.icon size={12} className="text-gray-600 group-hover:text-[#d4af37]" />
                                  <span className="text-[7px] font-black text-gray-500 group-hover:text-white tracking-tighter uppercase">
                                    {style.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Formato</label>
                            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#222] rounded-lg p-2 text-[10px] focus:outline-none focus:border-[#d4af37] appearance-none">
                              <option value="9:16">9:16</option>
                              <option value="16:9">16:9</option>
                              <option value="1:1">1:1</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Qualidade</label>
                            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#222] rounded-lg p-2 text-[10px] focus:outline-none focus:border-[#d4af37] appearance-none">
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
                            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border text-[9px] font-bold transition-all ${lowPriority ? 'bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
                          >
                            <Clock size={12} />
                            ECONOMIA
                          </button>
                          <button
                            type="button"
                            onClick={() => setUseGrounding(!useGrounding)}
                            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border text-[9px] font-bold transition-all ${useGrounding ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
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
                          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Quantidade</label>
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 5, 10].map(n => (
                              <button 
                                key={n} 
                                type="button" 
                                onClick={() => setQuantity(n)}
                                className={`w-8 h-8 rounded-lg border text-[10px] font-bold transition-all ${quantity === n ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        {type === 'video' && (
                          <div className="flex flex-col">
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Duração</label>
                            <div className="flex gap-1 mt-1">
                              {[4, 8].map(d => (
                                <button 
                                  key={d} 
                                  type="button" 
                                  onClick={() => setVideoDuration(d)}
                                  className={`w-8 h-8 rounded-lg border text-[10px] font-bold transition-all ${videoDuration === d ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-[#1a1a1a] border-[#222] text-gray-500'}`}
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
                        onClick={(e) => handleCreate(e, false)}
                      >
                        {isProcessing ? <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin" /> : <Play size={20} fill="currentColor" />}
                        GERAR ({getCostPerItem(false) * quantity * Math.max(1, prompt.split('\n').filter(p => p.trim() !== '').length)} CRÉDITOS)
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
                    {batch.filter(item => item.sourceTab === 'creative_studio').map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-[#111] rounded-[24px] border border-[#222] overflow-hidden group relative"
                      >
                        <div 
                          className="aspect-[9/16] bg-black relative cursor-pointer overflow-hidden"
                          onClick={() => {
                            const url = sessionPreviews[item.id] || item.previewUrl;
                            if (url) setSelectedMedia({ url, type: item.type === 'image' ? 'image' : 'video' });
                          }}
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
                              <p className="text-[8px] text-red-400 font-medium leading-tight line-clamp-3">{item.error}</p>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                              <div className="relative">
                                <div className="w-10 h-10 border-3 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[#d4af37]">
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
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
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
          <div className="w-full max-w-full mx-auto py-8 px-4 md:px-8">
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
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ator</span>
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
                        <span className="text-[10px] opacity-80 font-bold uppercase tracking-tighter">Custo: {getCostPerItem(true) * lipsyncQuantity} CRÉDITOS</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {batch.filter(item => item.sourceTab === 'lipsync').map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-[#111] rounded-[32px] border border-[#222] overflow-hidden group relative"
                      >
                        <div 
                          className="aspect-[9/16] bg-black relative cursor-pointer overflow-hidden"
                          onClick={() => {
                            const url = sessionPreviews[item.id] || item.previewUrl;
                            if (url) setSelectedMedia({ url, type: 'video' });
                          }}
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
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
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
                          <Briefcase size={24} className={useCreativeStudio ? 'text-[#d4af37]' : 'text-gray-500'} />
                          <h3 className="font-bold text-xl">Projetos Criativos Ads</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUseCreativeStudio(!useCreativeStudio)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${useCreativeStudio ? 'bg-[#d4af37]' : 'bg-gray-700'}`}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useCreativeStudio ? 'translate-x-6' : ''}`} />
                        </button>
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

                      {/* Logo Display/Upload */}
                      <div 
                        className={`aspect-[16/7] bg-[#1a1a1a] rounded-3xl border flex flex-col items-center justify-center gap-2 transition-all relative group ${creativeLogo ? 'border-[#d4af37] bg-[#d4af37]/5' : 'border-[#222] hover:border-[#333] cursor-pointer'}`}
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
                              className="h-full object-contain p-4" 
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
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Logo da Marca</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle: Prompt and Formats */}
                    <div className="flex-1 min-w-[350px] space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-widest">Instruções do Criativo (Prompt)</label>
                        <textarea 
                          value={creativePrompt}
                          onChange={(e) => setCreativePrompt(e.target.value)}
                          placeholder="Ex: Crie um anúncio de verão com foco em frescor e elegância..."
                          className="w-full bg-[#1a1a1a] border border-[#222] rounded-2xl p-5 text-sm focus:outline-none focus:border-[#d4af37] transition-colors resize-none h-32"
                        />
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
                        <span className="text-[10px] opacity-80 font-bold uppercase tracking-tighter">Custo: {getCostPerItem(false) * creativeQuantity} CRÉDITOS</span>
                      </button>
                    </div>
                  </div>

                  {/* Creative Styles and Strategies */}
                  <div className="w-full mt-10 pt-10 border-t border-[#222] space-y-10">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 flex items-center justify-center">
                          <Zap size={16} className="text-[#d4af37]" />
                        </div>
                        <div className="flex flex-col">
                          <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Estratégia do Criativo</h4>
                          <span className="text-[9px] text-gray-500 font-medium">Defina o objetivo psicológico e de marketing da peça</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {CREATIVE_STRATEGIES.map((strategy) => (
                          <button
                            key={strategy.id}
                            type="button"
                            onClick={() => setCreativeStrategy(strategy.name)}
                            className={`px-5 py-3.5 rounded-2xl border text-[10px] font-bold transition-all flex flex-col items-start gap-1 min-w-[160px] flex-1 md:flex-none ${creativeStrategy === strategy.name ? 'bg-[#d4af37] text-black border-[#d4af37] shadow-lg shadow-[#d4af37]/10' : 'bg-[#1a1a1a] border-[#222] text-gray-400 hover:border-[#333] hover:bg-[#1f1f1f]'}`}
                          >
                            <span className="uppercase tracking-wider">{strategy.name}</span>
                            <span className={`text-[8px] font-medium opacity-70 ${creativeStrategy === strategy.name ? 'text-black' : 'text-gray-500'}`}>{strategy.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 flex items-center justify-center">
                          <Palette size={16} className="text-[#d4af37]" />
                        </div>
                        <div className="flex flex-col">
                          <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Estética Visual</h4>
                          <span className="text-[9px] text-gray-500 font-medium">Escolha o estilo artístico e visual do criativo</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {CREATIVE_AESTHETICS.map((aesthetic) => (
                          <button
                            key={aesthetic.id}
                            type="button"
                            onClick={() => setCreativeAesthetic(aesthetic.name)}
                            className={`px-5 py-3.5 rounded-2xl border text-[10px] font-bold transition-all flex flex-col items-start gap-1 min-w-[160px] flex-1 md:flex-none ${creativeAesthetic === aesthetic.name ? 'bg-[#d4af37] text-black border-[#d4af37] shadow-lg shadow-[#d4af37]/10' : 'bg-[#1a1a1a] border-[#222] text-gray-400 hover:border-[#333] hover:bg-[#1f1f1f]'}`}
                          >
                            <span className="uppercase tracking-wider">{aesthetic.name}</span>
                            <span className={`text-[8px] font-medium opacity-70 ${creativeAesthetic === aesthetic.name ? 'text-black' : 'text-gray-500'}`}>{aesthetic.description}</span>
                          </button>
                        ))}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {batch.filter(item => item.sourceTab === 'projects').map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-[#111] rounded-[32px] border border-[#222] overflow-hidden group relative"
                      >
                        <div 
                          className="aspect-[9/16] bg-black relative cursor-pointer overflow-hidden"
                          onClick={() => {
                            const url = sessionPreviews[item.id] || item.previewUrl;
                            if (url) setSelectedMedia({ url, type: item.type === 'image' ? 'image' : 'video' });
                          }}
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
                    ))}
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
              {batch
                .filter(item => item.status === 'completed')
                .filter(item => {
                  if (libraryFilter === 'all') return true;
                  if (libraryFilter === 'image') return item.type === 'image';
                  if (libraryFilter === 'video') return item.type === 'video';
                  if (libraryFilter === 'lipsync') return item.type === 'lipsync';
                  return false;
                })
                .map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group bg-[#111] rounded-3xl border border-[#222] overflow-hidden hover:border-[#d4af37]/50 transition-all shadow-xl"
                  >
                    <div className="aspect-[9/16] relative bg-[#1a1a1a] overflow-hidden cursor-pointer"
                      onClick={() => {
                        const url = sessionPreviews[item.id] || item.previewUrl;
                        if (url) setSelectedMedia({ url, type: item.type === 'image' ? 'image' : 'video' });
                      }}
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
                            className="w-12 h-12 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 size={18} />
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
                ))}
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
                  description: 'Perfeito para quem está começando na criação de conteúdo.',
                  features: ['100 Créditos/mês', 'Geração de Imagens HD', 'Suporte via E-mail', 'Acesso aos Modelos Flash']
                },
                { 
                  name: 'Creator Pro', 
                  credits: 500, 
                  price: billingCycle === 'monthly' ? 97 : 77, 
                  description: 'Para profissionais que precisam de escala e qualidade máxima.',
                  features: ['500 Créditos/mês', 'Geração de Vídeos e LipSync', 'Suporte Prioritário WhatsApp', 'Acesso ao Gemini 1.5 Pro', 'Perfis de Marca Ilimitados'],
                  popular: true
                },
                { 
                  name: 'Elite Agency', 
                  credits: 2000, 
                  price: billingCycle === 'monthly' ? 297 : 237, 
                  description: 'A solução definitiva para agências de alta performance.',
                  features: ['2000 Créditos/mês', 'Prioridade na Fila de Geração', 'Gerente de Conta Dedicado', 'API Access (Beta)', 'Treinamento de Modelos Custom']
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
                    onClick={() => handlePurchase(plan.name, plan.credits)}
                    className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${plan.popular ? 'bg-[#d4af37] text-black hover:scale-105 shadow-lg shadow-[#d4af37]/20' : 'bg-[#1a1a1a] text-white border border-[#222] hover:bg-[#222]'}`}
                  >
                    Assinar Agora
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-[#111] border border-[#222] rounded-[48px] p-10 flex flex-wrap items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-[#d4af37]/10 rounded-3xl flex items-center justify-center border border-[#d4af37]/20">
                  <Zap size={32} className="text-[#d4af37]" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Precisa de mais fôlego?</h4>
                  <p className="text-gray-500 text-sm">Adquira pacotes de créditos avulsos sem assinatura mensal.</p>
                </div>
              </div>
              <button className="px-10 py-5 bg-white/5 text-white font-black rounded-3xl border border-white/10 hover:bg-white/10 transition-all uppercase tracking-widest text-xs">
                Ver Pacotes Avulsos
              </button>
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
            <motion.button
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[110]"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMedia(null);
              }}
            >
              <X size={24} />
            </motion.button>
            
            {selectedMedia.type === 'video' ? (
              <motion.video
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={selectedMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={selectedMedia.url}
                alt="Expanded view"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                referrerPolicy="no-referrer"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Processing Overlay Removed --- */}
    </div>
  );
}
