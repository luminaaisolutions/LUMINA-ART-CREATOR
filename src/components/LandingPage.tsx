import React from 'react';
import { motion } from 'motion/react';
import { 
  Zap, 
  Video, 
  ImageIcon, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  Cpu,
  Users
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#d4af37] selection:text-black">
      {/* --- Navbar --- */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d4af37] to-[#f1c40f] rounded-xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
              <Zap className="text-black w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tighter uppercase">
              LUMINA <span className="text-[#d4af37]">ART CREATOR</span>
            </span>
          </div>
          <button 
            onClick={onLogin}
            className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-all shadow-lg"
          >
            ENTRAR
          </button>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#d4af37]/5 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] text-xs font-black uppercase tracking-[0.2em] mb-8">
              Powered by Google Veo 3.1 & Imagen 3
            </span>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
              CRIE CONTEÚDO DE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f1c40f] to-[#d4af37]">ELITE EM LOTE</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              A primeira plataforma brasileira focada em escala. Gere centenas de vídeos e imagens cinematográficas com sincronismo labial perfeito em minutos.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={onLogin}
                className="w-full sm:w-auto bg-[#d4af37] text-black px-10 py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-2xl shadow-[#d4af37]/20"
              >
                COMEÇAR AGORA (40 CRÉDITOS GRÁTIS)
                <ArrowRight size={20} />
              </button>
              <button className="w-full sm:w-auto bg-[#111] border border-[#222] text-white px-10 py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-[#1a1a1a] transition-all">
                <Play size={20} className="text-[#d4af37]" />
                VER DEMONSTRAÇÃO
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- Features Grid --- */}
      <section className="py-24 px-6 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Layers className="text-[#d4af37]" size={32} />,
                title: "Geração em Lote",
                desc: "Não perca tempo criando um por um. Envie sua lista de prompts e gere centenas de ativos simultaneamente."
              },
              {
                icon: <Sparkles className="text-[#d4af37]" size={32} />,
                title: "Lipsync Avançado",
                desc: "Sincronismo labial ultra-realista que mapeia qualquer voz para qualquer personagem em vídeo ou imagem."
              },
              {
                icon: <Cpu className="text-[#d4af37]" size={32} />,
                title: "Tecnologia Veo 3.1",
                desc: "Acesso exclusivo aos modelos mais potentes do Google para vídeos cinematográficos em 4K."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-10 bg-[#111] border border-[#222] rounded-[2.5rem] hover:border-[#d4af37]/30 transition-all group"
              >
                <div className="mb-6 p-4 bg-[#1a1a1a] w-fit rounded-2xl group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Showcase Section --- */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-8">
                QUALIDADE QUE <br />
                <span className="text-[#d4af37]">DESAFIA A REALIDADE</span>
              </h2>
              <div className="space-y-6">
                {[
                  "Resolução nativa em até 4K cinematográfico",
                  "Consistência temporal perfeita entre frames",
                  "Controle total de iluminação e estilo artístico",
                  "Integração direta com Google Cloud Project"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <CheckCircle2 className="text-[#d4af37]" size={24} />
                    <span className="text-lg text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full">
              <div className="relative aspect-video bg-[#111] rounded-[3rem] border border-[#222] overflow-hidden shadow-2xl group">
                <img 
                  src="https://picsum.photos/seed/lumina-ai/1280/720" 
                  alt="Showcase" 
                  className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-[#d4af37] rounded-full flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 transition-all">
                    <Play size={32} className="text-black fill-current ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-8 left-8 right-8 p-6 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10">
                  <p className="text-sm font-mono text-[#d4af37]">PROMPT: "Cinematic shot of a futuristic neon city, 8k, highly detailed..."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Pricing Section --- */}
      <section className="py-24 px-6 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">PLANOS PARA TODOS OS <span className="text-[#d4af37]">CRIADORES</span></h2>
          <p className="text-gray-500">Escolha o plano que melhor se adapta à sua escala de produção.</p>
        </div>
        
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              name: "Iniciante",
              price: "R$ 47",
              features: ["100 Créditos/mês", "Geração de Imagens HD", "Suporte via E-mail", "1 Perfil de Marca"],
              cta: "COMEÇAR AGORA",
              popular: false
            },
            {
              name: "Creator Pro",
              price: "R$ 97",
              features: ["500 Créditos/mês", "Geração de Vídeos e LipSync", "Suporte Prioritário", "Perfis Ilimitados", "Sem Marca d'água"],
              cta: "ASSINAR AGORA",
              popular: true
            },
            {
              name: "Elite Agency",
              price: "R$ 297",
              features: ["2000 Créditos/mês", "API Access (Beta)", "Gerente de Conta", "Treinamento Custom", "Colaboração"],
              cta: "FALAR COM VENDAS",
              popular: false
            }
          ].map((plan, i) => (
            <div 
              key={i}
              className={`p-10 rounded-[3rem] border transition-all flex flex-col ${plan.popular ? 'bg-[#111] border-[#d4af37] scale-105 shadow-2xl shadow-[#d4af37]/10' : 'bg-[#111] border-[#222] hover:border-[#333]'}`}
            >
              {plan.popular && (
                <span className="bg-[#d4af37] text-black text-[10px] font-black px-4 py-1 rounded-full w-fit mb-6">MAIS POPULAR</span>
              )}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="text-gray-500 text-sm">/mês</span>
              </div>
              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((f, j) => (
                  <div key={j} className="flex items-center gap-3 text-sm text-gray-400">
                    <CheckCircle2 size={16} className="text-[#d4af37]" />
                    {f}
                  </div>
                ))}
              </div>
              <button 
                onClick={onLogin}
                className={`w-full py-4 rounded-2xl font-black transition-all ${plan.popular ? 'bg-[#d4af37] text-black hover:scale-[1.02]' : 'bg-[#222] text-white hover:bg-[#333]'}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* --- FAQ Section --- */}
      <section className="py-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">PERGUNTAS <span className="text-[#d4af37]">FREQUENTES</span></h2>
            <p className="text-gray-500">Tudo o que você precisa saber sobre a plataforma de elite.</p>
          </div>
          
          <div className="space-y-4">
            {[
              {
                q: "Como posso testar a plataforma?",
                a: "Ao criar sua conta e verificar seu e-mail, você ganha automaticamente 40 créditos de teste para experimentar todas as funcionalidades, incluindo geração de imagens e vídeos."
              },
              {
                q: "Como funcionam os créditos?",
                a: "Cada plano oferece uma quantidade mensal de créditos. Imagens custam 1 crédito, vídeos de 5s custam 10 créditos e vídeos de 8s custam 20 créditos. Os créditos são renovados a cada ciclo de faturamento."
              },
              {
                q: "Posso cancelar minha assinatura a qualquer momento?",
                a: "Sim. Você tem total controle sobre sua assinatura e pode cancelar através do painel de configurações sem multas ou burocracia."
              },
              {
                q: "Qual a qualidade dos vídeos gerados?",
                a: "Utilizamos o motor Google Veo 3.1, capaz de gerar vídeos em até 4K com alta fidelidade cinematográfica e consistência visual superior."
              },
              {
                q: "Os vídeos gerados são meus?",
                a: "Sim, você detém 100% dos direitos comerciais sobre todo o conteúdo gerado na Lumina Art Creator."
              },
              {
                q: "Existe suporte para agências?",
                a: "Sim, o plano Elite Agency inclui um gerente de conta dedicado e suporte prioritário para garantir que sua escala de produção nunca pare."
              }
            ].map((faq, i) => (
              <div key={i} className="bg-[#111] border border-[#222] rounded-3xl p-8 hover:border-[#d4af37]/30 transition-all group">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-3">
                  <span className="text-[#d4af37]">0{i+1}.</span>
                  {faq.q}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- CTA Footer --- */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#d4af37]/10 blur-[100px] rounded-full -z-10" />
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl font-black tracking-tighter mb-8">PRONTO PARA DOMINAR O <span className="text-[#d4af37]">ALGORITMO?</span></h2>
          <p className="text-gray-400 mb-12 text-lg">Junte-se a mais de 500 criadores de elite que já estão escalando sua produção com a Lumina.</p>
          <button 
            onClick={onLogin}
            className="bg-white text-black px-12 py-6 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-2xl"
          >
            CRIAR MINHA CONTA (40 CRÉDITOS)
          </button>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="py-12 px-6 border-t border-[#222] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 opacity-50">
            <Zap size={20} />
            <span className="font-bold tracking-tighter uppercase">LUMINA ART CREATOR</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500 font-medium">
            <a href="#" className="hover:text-[#d4af37] transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-[#d4af37] transition-colors">Privacidade</a>
            <a href="#" className="hover:text-[#d4af37] transition-colors">Contato</a>
          </div>
          <p className="text-xs text-gray-600 font-mono">© 2026 LUMINA AI SOLUTIONS. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
};
