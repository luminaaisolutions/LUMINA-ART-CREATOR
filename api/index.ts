import express from "express";
import path from "path";
import { Resend } from 'resend';
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import { GoogleAuth } from 'google-auth-library';

if (!process.env.VERCEL) {
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch (e) {
    console.log("Dotenv not found, skipping...");
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let dbAdmin: any = null;
let serviceAccountCredentials: any = null;

try {
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;
    
    if (serviceAccount) {
      serviceAccountCredentials = serviceAccount;
    }

    admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0723352507'
    });
  }
  dbAdmin = admin.firestore();
} catch (e) {
  console.error("[Startup] Firebase Admin failed to initialize:", e);
}

// Função para sobrepor logo na imagem gerada
// Engine de composição completa com template
async function composeTemplateImage(
  imageBase64: string,
  layers: any[],
  texts: any,
  logoBase64?: string,
  logoPosition: string = 'bottom-right'
): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const { createCanvas, registerFont, GlobalFonts } = await import('@napi-rs/canvas').catch(() => null) as any;

    // Se não tiver canvas, usa só o Sharp para logo
    if (!createCanvas) {
      console.warn('[Sharp] Canvas não disponível, aplicando apenas logo');
      if (logoBase64) {
        return await overlayLogoOnImage(imageBase64, logoBase64, logoPosition);
      }
      return imageBase64;
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const imageInfo = await sharp(imageBuffer).metadata();
    const imgWidth = imageInfo.width || 1080;
    const imgHeight = imageInfo.height || 1080;

    // Cria canvas do mesmo tamanho
    const canvas = createCanvas(imgWidth, imgHeight);
    const ctx = canvas.getContext('2d');

    // Desenha cada camada de texto
    for (const layer of layers) {
      if (!layer.type || layer.type === 'logo' || layer.type === 'divider') continue;

      const text = texts[layer.type] || layer.placeholder;
      if (!text) continue;

      const fontSize = Math.round((layer.fontSize || 40) * (imgWidth / 1080));
      const y = Math.round((layer.y / 100) * imgHeight);
      const fontWeight = layer.fontWeight >= 700 ? 'bold' : 'normal';

      ctx.font = `${fontWeight} ${fontSize}px ${layer.fontFamily || 'Arial'}`;
      ctx.fillStyle = layer.color || '#FFFFFF';
      ctx.textAlign = layer.align || 'center';
      ctx.textBaseline = 'middle';

      // Sombra
      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Background do CTA
      if (layer.backgroundColor && layer.backgroundColor !== 'transparent' && layer.type === 'cta') {
        const textWidth = ctx.measureText(text).width;
        const padX = Math.round((layer.paddingX || 40) * (imgWidth / 1080));
        const padY = Math.round((layer.paddingY || 14) * (imgWidth / 1080));
        const btnW = textWidth + padX * 2;
        const btnH = fontSize + padY * 2;
        const btnX = imgWidth / 2 - btnW / 2;
        const btnY = y - btnH / 2;
        const radius = Math.round((layer.borderRadius || 8) * (imgWidth / 1080));

        ctx.fillStyle = layer.backgroundColor;
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, radius);
        ctx.fill();

        ctx.fillStyle = layer.color || '#FFFFFF';
        if (layer.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 8;
        }
      }

      const xPos = layer.align === 'center' ? imgWidth / 2 : layer.align === 'right' ? imgWidth - 40 : 40;
      ctx.fillText(text, xPos, y);
    }

    // Converte canvas para buffer e composita sobre a imagem
    const canvasBuffer = canvas.toBuffer('image/png');
    const composited = await sharp(imageBuffer)
      .composite([{ input: canvasBuffer, blend: 'over' }])
      .png()
      .toBuffer();

    let result = composited.toString('base64');

    // Adiciona logo por cima de tudo
    if (logoBase64) {
      result = await overlayLogoOnImage(result, logoBase64, logoPosition);
    }

    console.log('[Sharp] Composição de template concluída com sucesso!');
    return result;

  } catch (err) {
    console.warn('[Sharp] Composição falhou, tentando apenas logo:', err);
    if (logoBase64) {
      return await overlayLogoOnImage(imageBase64, logoBase64, logoPosition);
    }
    return imageBase64;
  }
}

// Helper: get OAuth2 access token from service account for Vertex AI / Veo
// Usa LUMINA_SERVICE_ACCOUNT (projeto lumina-ai-solutions) como prioritário
// Fallback: FIREBASE_SERVICE_ACCOUNT
async function getServiceAccountAccessToken(): Promise<string | null> {
  try {
    // Prioridade: LUMINA_SERVICE_ACCOUNT (tem permissão no Veo/Vertex AI)
    const luminaSA = process.env.LUMINA_SERVICE_ACCOUNT
      ? JSON.parse(process.env.LUMINA_SERVICE_ACCOUNT)
      : null;

    const firebaseSA = serviceAccountCredentials ||
      (process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null);

    const serviceAccount = luminaSA || firebaseSA;

    if (!serviceAccount) {
      console.warn("[Auth] Nenhuma service account encontrada para OAuth token (Veo)");
      return null;
    }

    console.log(`[Auth] Usando SA: ${serviceAccount.client_email || 'unknown'}`);

    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token || null;
  } catch (e: any) {
    console.error("[Auth] Falha ao obter token OAuth:", e.message);
    return null;
  }
}

// Initialize Mercado Pago
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
  options: { timeout: 5000 }
});

// Helper: retry any async function up to maxAttempts times
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 3000,
  label: string = 'operation'
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        console.log(`[Retry] ${label} attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delayMs * attempt}ms...`);
        await new Promise(r => setTimeout(r, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

async function createServer() {
  const app = express();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  app.use(express.json({ limit: '50mb' }));

  console.log("=== SERVER STARTUP ===");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("VERCEL:", process.env.VERCEL);

  const possibleKeys = ['GEMINI_API_KEY', 'API_KEY', 'GOOGLE_API_KEY'];
  possibleKeys.forEach(k => {
    const val = process.env[k];
    if (val) {
      console.log(`Env Var ${k}: Present, starts with "${val.substring(0, 4)}", length: ${val.length}`);
    } else {
      console.log(`Env Var ${k}: Not found`);
    }
  });

  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  console.log("Final Gemini Key to use starts with:", geminiKey ? geminiKey.substring(0, 4) : "NONE");
  console.log("======================");

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Lumina API is running" });
  });

  app.post("/api/generate-wizard-prompt", async (req, res) => {
    try {
      const { adGoal, adPlatform, wizardProduct, wizardAudience, wizardStyle, wizardCta, modelType, creativeStrategy, creativeAesthetic, brandContext } = req.body;

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) return res.status(500).json({ error: "Chave de API não configurada." });

      const client = new GoogleGenAI({ apiKey: geminiKey });

      const goalMap: Record<string, string> = {
        vender: 'VENDAS DIRETAS — foco em conversão imediata, preço, CTA forte',
        engajar: 'ENGAJAMENTO — foco em emoção, compartilhamento, conexão',
        leads: 'CAPTAÇÃO DE LEADS — foco em benefício, formulário, gratuidade',
        awareness: 'AWARENESS DE MARCA — foco em identidade, valores, reconhecimento'
      };

      const platformMap: Record<string, string> = {
        instagram: 'Instagram Feed/Stories — visual impactante, texto curto',
        tiktok: 'TikTok Ads — dinâmico, jovem, autêntico, UGC style',
        facebook: 'Facebook Feed — texto mais longo, público 30+',
        youtube: 'YouTube Shorts/VSL — storytelling, gancho forte'
      };

      const styleMap: Record<string, string> = {
        urgencia: 'URGÊNCIA — cores quentes, countdown, escassez',
        elegante: 'ELEGANTE — minimalista, luxo, sofisticado',
        divertido: 'DIVERTIDO — colorido, dinâmico, descontraído',
        profissional: 'PROFISSIONAL — corporativo, sério, confiável'
      };

      const recommendedModel = 'nanoBanana'; // Nano Banana 2 — master do Wizard ADS

      // Mapas avançados baseados nos Frameworks Master + Visual Direction
      const layoutMap: Record<string, string> = {
        conversoes: 'PRODUCT_HERO — produto centralizado, fundo sólido, hierarquia clara',
        engajamento: 'SPLIT 50/50 — esquerda: texto + headline | direita: produto/pessoa',
        leads: 'BENEFITS_LIST — 3-5 benefícios com checkmarks, coluna de copy dominante',
        awareness: 'AGENCY_CURVED — wave shape dividindo foto + texto, profissional'
      };

      const hookMap: Record<string, string> = {
        conversoes: 'NUMBER — especificidade numérica cria credibilidade (ex: 3x mais resultado, 47% de desconto)',
        engajamento: 'IDENTITY — atribui identidade ao comprador, cria senso de tribo',
        leads: 'NEGATION — nega o pior aspecto da categoria (ex: sem burocracia, sem contrato)',
        awareness: 'CURIOSITY — curiosidade sem revelar tudo, força o clique'
      };

      const lightingMap: Record<string, string> = {
        instagram: '3-point professional setup: key light 45° + fill light suave + rim light separação',
        tiktok: 'Natural window light, authentic feel, soft shadows, candid atmosphere',
        facebook: 'Studio soft box, clean professional lighting, no harsh shadows',
        youtube: 'Cinematic 3-point lighting, dramatic key light, colored rim accent'
      };

      const colorTempMap: Record<string, string> = {
        urgencia: '6000K cold white — urgency, clarity, high energy',
        elegante: '3500K warm golden — luxury, sophistication, exclusivity',
        divertido: '5500K neutral bright — cheerful, energetic, vibrant',
        profissional: '5000K neutral — trust, authority, professionalism'
      };

      const nicheVisualMap: Record<string, string> = {
        default: 'dark premium background, gold accents, professional lighting',
        saude: 'clean white to soft green gradient, natural elements, bokeh soft circles',
        beleza: 'rose gold to champagne gradient, silk texture, feminine luxury',
        fitness: 'dark dramatic background, orange-red energy burst, power lighting',
        tech: 'ultra dark #070B14, electric blue grid lines, glassmorphism elements',
        gospel: 'deep navy #0D1B2A, golden divine light rays, purple accent #4A2080',
        food: 'warm dark chocolate background, amber spotlights, appetite-stimulating',
        educacao: 'bright white to sky blue, geometric shapes, knowledge atmosphere',
        imoveis: 'sophisticated dark navy, gold geometric lines, architectural abstract',
        moda: 'editorial black, diagonal spotlight, fashion magazine aesthetic'
      };

      // Detectar nicho automaticamente pelo produto/serviço
      const detectNiche = (product: string): string => {
        const p = product.toLowerCase();
        if (p.match(/saúde|suplemento|vitamina|nutrição|clínica|médico|farmácia/)) return 'saude';
        if (p.match(/beleza|cosmétic|maquiagem|skincare|cabelo|estética/)) return 'beleza';
        if (p.match(/academia|fitness|musculação|personal|treino|esporte/)) return 'fitness';
        if (p.match(/tech|software|app|sistema|digital|ia|inteligência/)) return 'tech';
        if (p.match(/igreja|gospel|cristã|ministério|culto|louvor|jesus/)) return 'gospel';
        if (p.match(/restaurante|comida|delivery|lanche|pizza|sushi|food/)) return 'food';
        if (p.match(/curso|escola|faculdade|educação|aula|ensino|treinamento/)) return 'educacao';
        if (p.match(/imóvel|apartamento|casa|imobiliária|terreno|construção/)) return 'imoveis';
        if (p.match(/moda|roupa|vestido|calçado|acessório|fashion|estilo/)) return 'moda';
        return 'default';
      };

      const detectedNiche = detectNiche(wizardProduct || '');
      const nicheVisual = nicheVisualMap[detectedNiche] || nicheVisualMap.default;
      const layout = layoutMap[adGoal] || layoutMap.conversoes;
      const hookFormula = hookMap[adGoal] || hookMap.conversoes;
      const lighting = lightingMap[adPlatform] || lightingMap.instagram;
      const colorTemp = colorTempMap[wizardStyle] || colorTempMap.profissional;

      const systemPrompt = `You are Lumina Ad Creator, the world's most advanced AI performance marketing designer, specialized in creating jaw-dropping, scroll-stopping social media ads for the Brazilian market. Your output must look like it was created by a top-tier creative agency with a $50,000 budget. Every element must be intentional, visually stunning, and conversion-optimized.

CAMPAIGN BRIEFING:
- OBJECTIVE: ${goalMap[adGoal] || adGoal}
- PLATFORM: ${platformMap[adPlatform] || adPlatform}
- PRODUCT/SERVICE: ${wizardProduct}
- TARGET AUDIENCE: ${wizardAudience || 'Brazilian general audience'}
- VISUAL STYLE: ${styleMap[wizardStyle] || wizardStyle}
- CTA TEXT: ${wizardCta || 'Saiba Mais'}
${brandContext ? `- BRAND IDENTITY: ${brandContext}` : ''}
${creativeStrategy ? `- STRATEGY: ${creativeStrategy}` : ''}
${creativeAesthetic ? `- AESTHETIC: ${creativeAesthetic}` : ''}

⚠️ CRITICAL RULES — NEVER VIOLATE:
1. NEVER use real names of people in the prompt. If the product/service is associated with a person, describe them ONLY by physical/emotional traits (e.g., "a charismatic Brazilian female singer with long blonde hair, expressive green eyes, confident smile"). NEVER mention proper names — this avoids copyright and AI generation issues.
2. NEVER include any logo, brand mark, or watermark in the image prompt. The client logo is applied separately as a post-processing overlay — do NOT describe or request any logo in the image.
3. The BRAND STRIP section must describe ONLY a subtle footer URL text or thin bottom bar — never a logo.
4. DO NOT include offer badges unless they genuinely serve the campaign objective (see badge rules below).

FRAMEWORK MASTER — 7 COMPONENTS:
1. HERO VISUAL: Occupies 55-65% of canvas — ${adGoal === 'conversoes' ? 'cinematic product hero shot, 3D photorealistic, studio lighting' : adGoal === 'lead' ? 'confident person portrait, direct eye contact, professional backdrop' : adGoal === 'engajamento' ? 'emotionally powerful lifestyle scene, authentic energy, candid moment' : 'aspirational brand scene, editorial quality, mood-first composition'}
2. HEADLINE: Max 6 words | Ultra-bold weight 900 | Hook formula: ${hookFormula} | INSTANTLY readable at thumbnail size | Must be RELEVANT to: ${wizardProduct}
3. SUBHEADLINE: 1 short sentence — must directly reinforce the headline with a SPECIFIC benefit, number, or proof point. NOT generic. Examples: "Mais de 10.000 clientes satisfeitos" / "Resultado garantido em 7 dias" / "A música que vai marcar sua história"
4. ${adGoal === 'conversoes' || adGoal === 'lead' ? `OFFER BADGE (REQUIRED for conversion): Choose ONE type based on the product context:
   - If there's a discount/price: PRICE SLASH badge — old price strikethrough + new price bold green
   - If there's scarcity: SCARCITY PILL — orange pill "ÚLTIMAS VAGAS" or "ENCERRA HOJE"  
   - If there's a guarantee: SHIELD badge — green "GARANTIA [X] DIAS"
   - If there's social proof: BURST badge — "+" + number + "CLIENTES" or "★★★★★"
   - If free offer: GREEN TAG — "GRÁTIS" or "FRETE GRÁTIS"
   Render with: 18-22% canvas width, drop shadow 10px, inner glow, rotation ±6°, ultra-bold condensed font` 
   : adGoal === 'engajamento' ? `ENGAGEMENT TRIGGER (optional — only if it adds value):
   - If viral/challenge content: flame tag "TREND DO MOMENTO"
   - If community-building: heart burst "#COMUNIDADE"
   - If shareable tip: "COMPARTILHE COM ALGUÉM QUE PRECISA"
   - If NONE fits naturally: OMIT the badge entirely — do not force it` 
   : `TRUST SIGNAL (optional — only if relevant to the brand):
   - If established brand: subtle "DESDE [ANO]" heritage stamp
   - If certified: blue checkmark "CERTIFICADO" or "OFICIAL"
   - If award-winning: gold seal "PREMIADO"
   - If NONE fits naturally: OMIT entirely — do not invent a badge that doesn't match`}
5. PRODUCT/HERO VISUAL: ${adGoal === 'conversoes' ? 'Product as hero — photorealistic 3D, studio lighting, mirror reflection' : 'Person described by physical traits ONLY — no names — with genuine emotion matching the campaign mood'}. If a reference person/product is provided, preserve 100% of their visual identity: facial features, skin tone, hair, expression, posture. Only change clothing/setting if needed for composition.
6. CTA BUTTON: Render EXACTLY "${wizardCta || 'Saiba Mais'}" as short pill button text — do not paraphrase or extend the CTA text. 3D pill shape, gradient fill, specular highlight, deep shadow, ultra-bold font.
7. FOOTER: Subtle URL text at bottom — small, elegant, not prominent. NO logo — logo is overlaid separately.

LAYOUT PRESET: ${layout}

PERSONA/PRODUCT FIDELITY — CRITICAL:
- If a human reference is provided: describe ONLY physical appearance traits (hair color/length/texture, eye color, skin tone, facial structure, expression, body type). NEVER use their name.
- Preserve identity 100%: same face structure, same hair, same expression quality. Only change: outfit, setting, lighting, background — to serve the ad composition.
- If a product reference is provided: preserve exact colors, shape, packaging, proportions. Only change: lighting angle, background, environment.

CINEMATIC LIGHTING & PHOTOGRAPHY:
- Lighting: ${lighting} | Color temperature: ${colorTemp}
- Dramatic rim lighting separating subject from background
- ${adGoal === 'lead' ? 'Corporate portrait: confident expression, direct eye contact, shallow DOF f/2.0, creamy bokeh background' : adGoal === 'engajamento' ? 'Lifestyle: golden hour natural light, authentic candid energy, warm tones' : adGoal === 'awareness' ? 'Editorial cinematic: anamorphic lens flare, film grain, moody color grade' : 'Premium packshot: 3-point studio lighting, product hero, mirror reflection underneath'}
- VISUAL TREND 2025: ${detectedNiche === 'tech' ? 'Dark glassmorphism — frosted panels, electric blue grid lines, holographic overlays' : detectedNiche === 'gospel' ? 'Divine dark luxe — deep navy, golden god rays, purple mystical particles' : detectedNiche === 'fitness' ? 'Power dramatic — split lighting, orange-red energy burst, dark concrete' : detectedNiche === 'beleza' ? '3D hyperreal — liquid organic shapes, rose gold surfaces, silk textures' : detectedNiche === 'food' ? 'Appetite cinematic — warm amber, steam rising, macro textures, dark moody' : 'Controlled maximalism — rich layered depth, bold contrasts, premium feel'}
- NICHE VISUAL BASE: ${nicheVisual}

ADVANCED TYPOGRAPHY — INTELLIGENT ADAPTIVE SYSTEM:
The typography must be treated as a DESIGN ELEMENT, not just text. Every font choice, size, weight, tracking and effect must harmonize perfectly with the hero image, persona, product, and overall mood. The text must NEVER look pasted on — it must feel like it was born with the image.

TYPOGRAPHY INTELLIGENCE RULES:
- Analyze the visual complexity of the scene and adjust font weight inversely — busy backgrounds need heavier fonts with stronger shadows; minimal clean backgrounds can use lighter, more elegant fonts
- Font size hierarchy STRICT: HEADLINE 2.5-3x larger than subheadline, CTA 1.5-2x larger than subheadline
- NEVER use the same font weight for more than one text element
- Text placement must respect the visual center of gravity — never cover the face, eyes, or hero product
- If persona is present: text goes in the lower 35% or upper 15% of the canvas — NEVER over the face
- If product is hero: headline text frames the product, never overlaps it

STYLE-MATCHED FONT SYSTEM:
${wizardStyle === 'urgencia' ? `
URGENCY TYPOGRAPHY — Maximum Impact:
- HEADLINE: Bebas Neue or Impact Condensed | Size: DOMINANT — 3x subheadline | Style: 3D extruded with 8px perspective shadow, electric orange inner glow (#FF6B00), white fill, 3px black stroke | Effect: slight upward angle -3deg for kinetic energy
- SUBHEADLINE: Oswald SemiBold | Size: medium | Style: white, hard black shadow 3px offset, slightly condensed | Placement: immediately below headline with 12px gap
- CTA BUTTON TEXT: Oswald ExtraBold ALL CAPS | Style: white on deep red-to-orange gradient (#D00→#FF6B00), embossed, inner highlight | Size: 1.8x subheadline
- OVERLAY TEXT (if price/offer): Anton Regular | Yellow (#FFE500) fill, black outline 2.5px, rotation -5° | Maximum contrast against any background`
: wizardStyle === 'elegante' ? `
ELEGANT TYPOGRAPHY — Refined Luxury:
- HEADLINE: Playfair Display Black Italic or Cormorant Garamond Bold | Size: large but NOT aggressive | Style: gold foil metallic gradient (#D4AF37→#F5E6A3→#D4AF37), letter press emboss effect, tracking +80 | Effect: subtle shadow blur 4px, no hard edges
- SUBHEADLINE: Cormorant Garamond Light Italic | Size: 40% of headline | Style: champagne white, letterspacing +120, ultra-thin | Placement: centered, generous space below headline
- CTA BUTTON TEXT: Didot Regular | Style: platinum chrome on dark pill, mirror reflection highlight | Size: 1.5x subheadline, never aggressive
- OVERALL: generous whitespace between ALL text elements — crowding kills elegance`
: wizardStyle === 'luxo' ? `
LUXURY TYPOGRAPHY — Prestige & Authority:
- HEADLINE: Didot Bold or Bodoni 72 Bold | Size: commanding — 2.8x subheadline | Style: chrome mirror effect, platinum-to-pure-white gradient, razor-sharp serifs, 2px white stroke | Shadow: deep 6px offset, 45°, black with 20% opacity for subtle depth
- SUBHEADLINE: Optima Regular or Trajan Pro Light | Size: 35% of headline | Style: warm gold (#D4AF37), ultra-refined, tracking +60, ultra-readable | Placement: 16px below headline
- CTA BUTTON TEXT: Trajan Pro Bold ALL CAPS | Style: gold embossed on dark obsidian pill (#1a1a1a), inner gold glow, regal | Size: between headline and subheadline
- OVERLAY TEXT: Copperplate Gothic | Metallic gold gradient, premium | All text must feel like it belongs on a $500 product`
: wizardStyle === 'divertido' ? `
PLAYFUL TYPOGRAPHY — Energy & Joy:
- HEADLINE: Paytone One or Boogaloo | Size: BIG and BOLD — almost aggressive | Style: rainbow gradient (pink→orange→yellow→green), thick white outline 5px, 3D extrusion with depth shadow, playful slight rotation (+2° to -2°) | Effect: bouncy feel, rounded
- SUBHEADLINE: Nunito ExtraBold 800 | Size: 45% of headline | Style: bright contrasting solid color (electric blue or hot pink), friendly shadow, rounded feel | Placement: close to headline, energetic
- CTA BUTTON TEXT: Fredoka One or Rounded Bold | Style: white on vivid saturated gradient pill, bubbly corners | Size: matches subheadline
- OVERALL: colors must POP — maximum saturation, zero subtlety, joyful chaos with structure`
: wizardStyle === 'minimalista' ? `
MINIMALIST TYPOGRAPHY — Less is More:
- HEADLINE: Helvetica Neue UltraLight or Futura Light | Size: surprisingly large but hairline weight | Style: NO fill — only 0.5px stroke, maximum letterspacing +400 | Effect: pure negative space art — the emptiness IS the design
- SUBHEADLINE: Futura Light or Gill Sans Light | Size: 50% of headline | Style: 50% grey, balanced, zero decoration | Placement: 24px below headline with no shadow
- CTA BUTTON TEXT: Gill Sans Regular | Style: dark text on white pill or white on dark pill — binary contrast only | Size: same as subheadline
- RULE: maximum 2 text elements visible at once — everything else is visual silence`
: `
PROFESSIONAL TYPOGRAPHY — Balanced Authority:
- HEADLINE: Montserrat Black 900 or Inter Black | Size: dominant — 2.5x subheadline | Style: clean white fill, crisp drop shadow 4px at 45°, 1px white stroke for crispness | Effect: strong hierarchy, zero decoration beyond shadow
- SUBHEADLINE: Inter SemiBold 600 or Lato SemiBold | Size: 40% of headline | Style: light grey (#CCCCCC) or white 80%, clean, modern, no decoration | Placement: 14px below headline
- CTA BUTTON TEXT: Montserrat ExtraBold ALL CAPS | Style: white on brand gradient pill, professional | Size: 1.6x subheadline
- OVERALL: precision and clarity — every element earns its place`}

TEXT RENDERING — OVERLAY DIRECTIVE:
- HEADLINE text: render as large overlay text in upper-third or lower-third. SPECIFIC POSITION: ${adGoal === 'conversoes' ? 'lower third, above CTA button' : adGoal === 'awareness' ? 'upper third, centered' : adGoal === 'engajamento' ? 'upper-center, dynamic placement' : 'centered, commanding'}
- SUBHEADLINE: immediately below headline, same horizontal alignment
- CTA text: render as pill/button shape at bottom-center — EXACT TEXT: "${wizardCta || 'Saiba Mais'}" — do NOT paraphrase, do NOT translate, do NOT modify
- All text elements: render with explicit drop shadows and outlines as specified above — text must be 100% readable at thumbnail size (200x200px)

PORTUGUESE TEXT — ZERO ERROR POLICY:
- Headline: CREATE in perfect Brazilian Portuguese for: ${wizardProduct} | Goal: ${goalMap[adGoal] || adGoal} | MAX 6 WORDS
- Subheadline: 1 sentence, SPECIFIC benefit/number/proof — NOT generic. Examples: "Resultado em 7 dias garantido" / "+10.000 clientes transformados" / "Frete grátis hoje"
- CTA: render CHARACTER BY CHARACTER: "${wizardCta || 'Saiba Mais'}" — zero changes
- Mandatory accents: ã ç ê ó á í ú â ô õ — NEVER omit
- Zero tolerance: "promoçao"→"promoção" | "voce"→"você" | "musica"→"música"

COMPOSITION & QUALITY:
- Visual hierarchy: HERO → HEADLINE → SUBHEADLINE → BADGE (if present) → CTA → FOOTER URL
- Text never covers: face/eyes of persona, hero product, key visual element
- Minimum 40% breathing space — never cluttered
- Rounded corners 12-24px on all closed elements
- 4K resolution, photorealistic, zero artifacts, no watermarks, no logos embedded in image
- Agency-grade finish — $50k campaign creative
- FINAL CHECK: would a senior art director approve this? If not, adjust.

OUTPUT: ONE complete image prompt in English (maximum 450 words). Include ALL visual specs above. No explanations — prompt only.`;

      const result = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });

      const prompt = result.text?.trim();
      if (!prompt) return res.status(500).json({ error: "Não foi possível gerar o prompt." });

      console.log(`[WizardPrompt] goal=${adGoal} model=${recommendedModel} cta="${wizardCta}" product="${(wizardProduct || '').substring(0, 30)}"`);

      return res.json({ prompt, recommendedModel });
    } catch (error: any) {
      console.error("Wizard Prompt Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Mercado Pago Payment Creation
  app.post("/api/create-payment", async (req, res) => {
    try {
      const { planName, credits, amount, userId, userEmail } = req.body;

      const preference = new Preference(mpClient);
      const result = await preference.create({
        body: {
          items: [
            {
              id: planName,
              title: `Lumina Art Creator - Plano ${planName}`,
              quantity: 1,
              unit_price: amount,
              currency_id: 'BRL'
            }
          ],
          payer: { email: userEmail },
          back_urls: {
            success: `${req.headers.origin}/dashboard?payment=success`,
            failure: `${req.headers.origin}/dashboard?payment=failure`,
            pending: `${req.headers.origin}/dashboard?payment=pending`
          },
          auto_return: 'approved',
          notification_url: `${process.env.WEBHOOK_URL || req.headers.origin}/api/webhooks/mercadopago`,
          metadata: {
            user_id: userId,
            plan_name: planName,
            credits: credits
          }
        }
      });

      res.json({ id: result.id, init_point: result.init_point });
    } catch (error: any) {
      console.error("Mercado Pago Preference Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mercado Pago Webhook
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-signature'] as string;
        if (!signature || !signature.includes(webhookSecret)) {
          console.warn("[MercadoPago Webhook] Invalid signature - request rejected");
          return res.status(401).send("Unauthorized");
        }
      }

      const { type, data } = req.body;
      console.log(`[MercadoPago Webhook] Type: ${type}, Data ID: ${data?.id}`);

      if (type === 'payment') {
        const payment = new Payment(mpClient);
        const paymentData = await payment.get({ id: data.id });

        if (paymentData.status === 'approved') {
          const { user_id, plan_name, credits } = paymentData.metadata;

          if (!dbAdmin) throw new Error("Firebase Admin not initialized");

          const userRef = dbAdmin.collection('users').doc(user_id);
          await dbAdmin.runTransaction(async (transaction: any) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error("User not found");

            const currentCredits = userDoc.data()?.credits || 0;
            transaction.update(userRef, {
              credits: currentCredits + Number(credits),
              plan: plan_name.toLowerCase()
            });

            const paymentRef = dbAdmin.collection('payments').doc(String(data.id));
            transaction.set(paymentRef, {
              id: String(data.id),
              userId: user_id,
              amount: paymentData.transaction_amount,
              credits: Number(credits),
              plan: plan_name,
              status: 'approved',
              method: paymentData.payment_method_id,
              createdAt: new Date().toISOString()
            });
          });
        }
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Mercado Pago Webhook Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send OTP
  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email, code, userId } = req.body;
      console.log(`[OTP] Enviando código para ${email} (User: ${userId})`);

      if (userId && dbAdmin) {
        await dbAdmin.collection('users').doc(userId).update({
          verificationCode: code
        });
      }

      if (resend) {
        await resend.emails.send({
          from: 'Lumina <noreply@luminaaisolutions.com.br>',
          to: email,
          subject: 'Seu Código de Verificação - Lumina',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #d4af37; text-align: center;">Bem-vindo à LUMINA</h2>
              <p>Olá,</p>
              <p>Obrigado por se cadastrar na Lumina. Use o código abaixo para verificar sua conta:</p>
              <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111; margin: 20px 0;">
                ${code}
              </div>
              <p style="font-size: 12px; color: #777;">Este código expira em 10 minutos.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="text-align: center; font-size: 14px; color: #999;">&copy; 2026 Lumina Art Creator</p>
            </div>
          `
        });
        res.json({ success: true, message: "Código enviado com sucesso via Resend" });
      } else {
        console.warn("[MOCK EMAIL] RESEND_API_KEY não configurada. Simulando envio.");
        res.json({ success: true, message: "Código enviado com sucesso (simulado)" });
      }
    } catch (error: any) {
      console.error("Erro ao enviar OTP:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify Account
  app.post("/api/verify-account", async (req, res) => {
    try {
      const { userId, code } = req.body;
      if (!userId || !code) return res.status(400).json({ error: "UserId and code are required" });
      if (!dbAdmin) return res.status(500).json({ error: "Firebase Admin not initialized" });

      const userRef = dbAdmin.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const userData = userDoc.data();
      if (userData.isVerified) return res.status(400).json({ error: "User already verified" });
      if (userData.verificationCode !== code) {
        return res.status(400).json({ error: "Código de verificação incorreto" });
      }

      await userRef.update({
        isVerified: true,
        credits: 40,
        verificationCode: admin.firestore.FieldValue.delete()
      });

      if (userData.referredBy) {
        try {
          const referrers = await dbAdmin.collection('users')
            .where('referralCode', '==', userData.referredBy)
            .limit(1)
            .get();
          if (!referrers.empty) {
            const referrerDoc = referrers.docs[0];
            if (referrerDoc.id !== userId) {
              await referrerDoc.ref.update({
                credits: admin.firestore.FieldValue.increment(10),
                referralCount: admin.firestore.FieldValue.increment(1)
              });
            }
          }
        } catch (refErr) {
          console.error("[Referral] Bonus grant failed:", refErr);
        }
      }

      res.json({ success: true, message: "Account verified and credits granted" });
    } catch (error: any) {
      console.error("Account verification error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for downloads
  app.get("/api/proxy-download", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "URL is required" });

      const response = await fetch(url as string, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow'
      });

      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", "attachment");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Proxy Download Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Main Gemini API Proxy
  app.post("/api/gemini", async (req, res) => {
    try {
      const { method, args, apiKey: clientApiKey } = req.body;

      // --- generateGptImage — tratado ANTES da validação de GEMINI_API_KEY ---
      if (method === 'generateGptImage') {
        console.log(`[GptImage2] Calling gpt-image-2 via fal.ai`);

        const falKey = process.env.FAL_API_KEY;
        if (!falKey) {
          console.error("[GptImage2] FAL_API_KEY not configured");
          return res.status(503).json({ error: "Serviço GPT Image 2 indisponível. Configure FAL_API_KEY." });
        }

        // Mapeamento de aspect ratio para image_size do gpt-image-2 via fal.ai
        const imageSizeMap: Record<string, string> = {
          '1:1':    'square_hd',
          '9:16':   'portrait_16_9',
          '16:9':   'landscape_16_9',
          '4:5':    'portrait_4_3',
          '1.91:1': 'landscape_16_9'
        };

        const hasReferenceImage = !!(args.referenceImageBase64);
        const endpoint = hasReferenceImage
          ? 'https://fal.run/fal-ai/gpt-image-2/image-to-image'
          : 'https://fal.run/fal-ai/gpt-image-2';

        const gptBody: any = {
          prompt: args.prompt,
          image_size: imageSizeMap[args.aspectRatio || '1:1'] || 'square_hd',
          quality: args.quality === 'QUALITY' ? 'high' : 'medium',
          num_images: 1,
          output_format: 'png'
        };

        // Adiciona referências se houver
        if (hasReferenceImage) {
          // Upload da imagem de referência para fal.ai
          try {
            const uploadRes = await fetch('https://fal.run/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${falKey}`,
                'Content-Type': 'application/octet-stream',
                'X-Fal-File-Name': 'reference.png'
              },
              body: Buffer.from(args.referenceImageBase64, 'base64')
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              const refUrl = uploadData?.url || uploadData?.file_url;
              if (refUrl) {
                gptBody.image_urls = [refUrl];
                console.log(`[GptImage2] Referência uploaded: ${refUrl}`);
              }
            }
          } catch (uploadErr) {
            console.warn('[GptImage2] Upload de referência falhou:', uploadErr);
          }

          // Upload do logo se disponível
          if (args.logoBase64) {
            try {
              const logoUploadRes = await fetch('https://fal.run/files/upload', {
                method: 'POST',
                headers: {
                  'Authorization': `Key ${falKey}`,
                  'Content-Type': 'application/octet-stream',
                  'X-Fal-File-Name': 'logo.png'
                },
                body: Buffer.from(args.logoBase64, 'base64')
              });
              if (logoUploadRes.ok) {
                const logoData = await logoUploadRes.json();
                const logoUrl = logoData?.url || logoData?.file_url;
                if (logoUrl) {
                  gptBody.image_urls = [...(gptBody.image_urls || []), logoUrl];
                  console.log(`[GptImage2] Logo uploaded: ${logoUrl}`);
                }
              }
            } catch (logoErr) {
              console.warn('[GptImage2] Upload de logo falhou:', logoErr);
            }
          }
        }

        console.log(`[GptImage2] endpoint=${hasReferenceImage ? 'image-to-image' : 't2i'} size=${gptBody.image_size} quality=${gptBody.quality}`);
        console.log(`[GptImage2] Prompt: "${(args.prompt || '').substring(0, 80)}..."`);

        const gptResponse = await withRetry(
          () => fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Key ${falKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(gptBody)
          }),
          3, 4000, 'generateGptImage2'
        );

        if (!gptResponse.ok) {
          const errData = await gptResponse.json().catch(() => ({ error: gptResponse.statusText }));
          console.error("[GptImage2] API error:", JSON.stringify(errData));
          return res.status(gptResponse.status).json({ error: errData?.detail || errData?.error || 'GPT Image 2 generation failed' });
        }

        const gptData = await gptResponse.json();
        console.log(`[GptImage2] Sucesso. Images: ${gptData?.images?.length || 0}`);

        if (gptData?.images?.[0]?.url) {
          const imgResponse = await fetch(gptData.images[0].url);
          const imgBuffer = await imgResponse.arrayBuffer();
          let base64 = Buffer.from(imgBuffer).toString('base64');

          // Sobrepõe logo real da marca se disponível
          if (args.logoBase64 && args.logoPosition && !args.templateLayers) {
            console.log(`[Sharp/GptImage2] Sobrepondo logo na posição: ${args.logoPosition}`);
            base64 = await overlayLogoOnImage(base64, args.logoBase64, args.logoPosition);
          }

          // ENGINE DE COMPOSIÇÃO — Template com camadas
          if (args.templateLayers && args.templateTexts) {
            console.log(`[Sharp/GptImage2] Composição de template com ${args.templateLayers.length} camadas`);
            base64 = await composeTemplateImage(
              base64,
              args.templateLayers,
              args.templateTexts,
              args.logoBase64ForTemplate,
              args.logoPositionForTemplate || 'bottom-right'
            );
          }

          return res.json({
            generatedImages: [{
              image: {
                imageBytes: base64,
                mimeType: 'image/png'
              }
            }]
          });
        }

        return res.status(500).json({ error: 'GPT Image 2 não retornou imagem válida.' });
      }

      // --- generateNanoBanana — tratado ANTES da validação de GEMINI_API_KEY ---
      if (method === 'generateNanoBanana') {
        console.log(`[NanoBanana] Calling Nano Banana 2 via fal.ai`);

        const falKey = process.env.FAL_API_KEY;
        if (!falKey) {
          console.error("[NanoBanana] FAL_API_KEY not configured");
          return res.status(503).json({ error: "Serviço Nano Banana indisponível. Configure FAL_API_KEY." });
        }

        const aspectRatioMap: Record<string, string> = {
          '1:1':    '1:1',
          '9:16':   '9:16',
          '16:9':   '16:9',
          '4:5':    '4:5',
          '1.91:1': '16:9'
        };

        // Decide endpoint: edit (com referências) ou text-to-image (puro)
        const hasReferences = !!(args.referenceImageBase64 || args.logoBase64);
        const endpoint = hasReferences
          ? 'https://fal.run/fal-ai/nano-banana-2/edit'
          : 'https://fal.run/fal-ai/nano-banana-2';

        const nanoBananaBody: any = {
          prompt: args.prompt,
          aspect_ratio: aspectRatioMap[args.aspectRatio || '1:1'] || '1:1',
          num_images: 1,
          output_format: 'png',
          safety_tolerance: '4',
        };

        // Faz upload das referências para fal.ai e passa as URLs
        const imageUrls: string[] = [];

        if (args.referenceImageBase64) {
          try {
            const uploadRes = await fetch('https://fal.run/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${falKey}`,
                'Content-Type': 'application/octet-stream',
                'X-Fal-File-Name': 'reference.jpg'
              },
              body: Buffer.from(args.referenceImageBase64, 'base64')
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              const refUrl = uploadData?.url || uploadData?.file_url;
              if (refUrl) {
                imageUrls.push(refUrl);
                console.log(`[NanoBanana] Referência uploaded: ${refUrl}`);
              }
            }
          } catch (uploadErr) {
            console.warn('[NanoBanana] Upload de referência falhou:', uploadErr);
          }
        }

        if (args.logoBase64) {
          try {
            const logoUploadRes = await fetch('https://fal.run/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${falKey}`,
                'Content-Type': 'application/octet-stream',
                'X-Fal-File-Name': 'logo.png'
              },
              body: Buffer.from(args.logoBase64, 'base64')
            });
            if (logoUploadRes.ok) {
              const logoData = await logoUploadRes.json();
              const logoUrl = logoData?.url || logoData?.file_url;
              if (logoUrl) {
                imageUrls.push(logoUrl);
                console.log(`[NanoBanana] Logo uploaded: ${logoUrl}`);
              }
            }
          } catch (logoErr) {
            console.warn('[NanoBanana] Upload de logo falhou:', logoErr);
          }
        }

        if (imageUrls.length > 0) {
          nanoBananaBody.image_urls = imageUrls;
        }

        console.log(`[NanoBanana] endpoint=${hasReferences ? 'edit' : 't2i'} prompt="${(args.prompt || '').substring(0, 80)}..." ratio=${nanoBananaBody.aspect_ratio}`);

        const nanoBananaResponse = await withRetry(
          () => fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Key ${falKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(nanoBananaBody)
          }),
          3, 3000, 'generateNanoBanana'
        );

        if (!nanoBananaResponse.ok) {
          const errData = await nanoBananaResponse.json().catch(() => ({ error: nanoBananaResponse.statusText }));
          console.error("[NanoBanana] API error:", JSON.stringify(errData));
          return res.status(nanoBananaResponse.status).json({ error: errData?.detail || errData?.error || 'Nano Banana generation failed' });
        }

        const nanoBananaData = await nanoBananaResponse.json();
        console.log(`[NanoBanana] Sucesso. Images: ${nanoBananaData?.images?.length || 0}`);

        if (nanoBananaData?.images?.[0]?.url) {
          const imgResponse = await fetch(nanoBananaData.images[0].url);
          const imgBuffer = await imgResponse.arrayBuffer();
          let base64 = Buffer.from(imgBuffer).toString('base64');
          const mimeType = imgResponse.headers.get('content-type') || 'image/png';

          // Sobrepõe logo real da marca se disponível
          if (args.logoBase64 && args.logoPosition && !args.templateLayers) {
            console.log(`[Sharp/NanoBanana] Sobrepondo logo na posição: ${args.logoPosition}`);
            base64 = await overlayLogoOnImage(base64, args.logoBase64, args.logoPosition);
          }

          // ENGINE DE COMPOSIÇÃO — Template com camadas
          if (args.templateLayers && args.templateTexts) {
            console.log(`[Sharp/NanoBanana] Composição de template com ${args.templateLayers.length} camadas`);
            base64 = await composeTemplateImage(
              base64,
              args.templateLayers,
              args.templateTexts,
              args.logoBase64ForTemplate,
              args.logoPositionForTemplate || 'bottom-right'
            );
          }

          return res.json({
            generatedImages: [{
              image: {
                imageBytes: base64,
                mimeType: 'image/png'
              }
            }]
          });
        }

        return res.status(500).json({ error: 'Nano Banana não retornou imagem válida.' });
      }

      // --- generateIdeogram — tratado ANTES da validação de GEMINI_API_KEY ---
      if (method === 'generateIdeogram') {
        console.log(`[Gemini Proxy] Calling Ideogram V3 via fal.ai`);

        const falKey = process.env.FAL_API_KEY;
        if (!falKey) {
          console.error("[Ideogram] FAL_API_KEY not configured");
          return res.status(503).json({ error: "Serviço Ideogram indisponível. Configure FAL_API_KEY." });
        }

        const imageSizeMap: Record<string, string> = {
          '1:1':    'square_hd',
          '9:16':   'portrait_16_9',
          '16:9':   'landscape_16_9',
          '4:5':    'portrait_4_3',
          '1.91:1': 'landscape_16_9',
          '4:3':    'landscape_4_3',
          '3:4':    'portrait_4_3',
        };

        const ideogramBody: any = {
          prompt: args.prompt,
          image_size: imageSizeMap[args.aspectRatio || '1:1'] || 'square_hd',
          rendering_speed: args.quality === 'QUALITY' ? 'QUALITY' : 'BALANCED',
          expand_prompt: false,
          num_images: 1,
          style: 'REALISTIC',
        };

        // Adiciona referência de personagem se houver (base64 → upload fal.ai → URL)
        const styleRefs: { image_url: string }[] = [];

        if (args.referenceImageBase64) {
          try {
            const uploadRes = await fetch('https://fal.run/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${falKey}`,
                'Content-Type': 'application/octet-stream',
                'X-Fal-File-Name': 'reference.jpg'
              },
              body: Buffer.from(args.referenceImageBase64, 'base64')
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              const refUrl = uploadData?.url || uploadData?.file_url;
              if (refUrl) {
                styleRefs.push({ image_url: refUrl });
                console.log(`[Ideogram] Referência de personagem uploaded: ${refUrl}`);
              }
            }
          } catch (uploadErr) {
            console.warn('[Ideogram] Upload de referência falhou:', uploadErr);
          }
        }

        // Adiciona logo da marca como referência visual
        if (args.logoBase64) {
          try {
            const logoUploadRes = await fetch('https://fal.run/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${falKey}`,
                'Content-Type': 'application/octet-stream',
                'X-Fal-File-Name': 'logo.png'
              },
              body: Buffer.from(args.logoBase64, 'base64')
            });
            if (logoUploadRes.ok) {
              const logoData = await logoUploadRes.json();
              const logoUrl = logoData?.url || logoData?.file_url;
              if (logoUrl) {
                styleRefs.push({ image_url: logoUrl });
                console.log(`[Ideogram] Logo uploaded: ${logoUrl}`);
              }
            }
          } catch (logoErr) {
            console.warn('[Ideogram] Upload de logo falhou:', logoErr);
          }
        }

        if (styleRefs.length > 0) {
          ideogramBody.style_reference_images = styleRefs;
        }

        console.log(`[Ideogram] Prompt: "${(args.prompt || '').substring(0, 80)}..." | Ratio: ${ideogramBody.aspect_ratio}`);
        const ideogramResponse = await withRetry(
          () => fetch('https://fal.run/fal-ai/ideogram/v3', {
            method: 'POST',
            headers: {
              'Authorization': `Key ${falKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(ideogramBody)
          }),
          3, 3000, 'generateIdeogram'
        );

        if (!ideogramResponse.ok) {
          const errData = await ideogramResponse.json().catch(() => ({ error: ideogramResponse.statusText }));
          console.error("[Ideogram] API error:", JSON.stringify(errData));
          return res.status(ideogramResponse.status).json({ error: errData?.detail || errData?.error || 'Ideogram generation failed' });
        }

        const ideogramData = await ideogramResponse.json();
        console.log(`[Ideogram] Sucesso. Images: ${ideogramData?.images?.length || 0}`);

        if (ideogramData?.images?.[0]?.url) {
          const imgResponse = await fetch(ideogramData.images[0].url);
          const imgBuffer = await imgResponse.arrayBuffer();
          let base64 = Buffer.from(imgBuffer).toString('base64');
          const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

          // Sobrepõe logo real da marca se disponível (sem template)
          if (args.logoBase64 && args.logoPosition && !args.templateLayers) {
            console.log(`[Sharp] Sobrepondo logo na posição: ${args.logoPosition}`);
            base64 = await overlayLogoOnImage(base64, args.logoBase64, args.logoPosition);
          }

          // ENGINE DE COMPOSIÇÃO — Template com camadas
          if (args.templateLayers && args.templateTexts) {
            console.log(`[Sharp] Iniciando composição de template com ${args.templateLayers.length} camadas`);
            base64 = await composeTemplateImage(
              base64,
              args.templateLayers,
              args.templateTexts,
              args.logoBase64ForTemplate,
              args.logoPositionForTemplate || 'bottom-right'
            );
          }

          return res.json({
            generatedImages: [{
              image: {
                imageBytes: base64,
                mimeType: 'image/png'
              }
            }]
          });
        }

        return res.status(500).json({ error: 'Ideogram não retornou imagem válida.' });
      }

      const keysToTry = [
        process.env.GEMINI_API_KEY,
        process.env.API_KEY,
        clientApiKey
      ];

      let apiKey = keysToTry.find(k => k && k.length > 20 && k.startsWith('AIza'));

      if (!apiKey) {
        console.error("[Gemini Proxy] CRITICAL: No valid API Key found.");
        return res.status(503).json({
          error: "Serviço Indisponível",
          message: "Estamos realizando uma manutenção rápida em nossos motores de IA. Por favor, tente novamente em alguns instantes."
        });
      }

      apiKey = apiKey.toString().trim();

      const defaultSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
      ];

      // --- uploadToFal — upload de arquivo base64 para fal.ai storage ---
      if (method === 'uploadToFal') {
        const falKey = process.env.FAL_API_KEY;
        if (!falKey) return res.status(503).json({ error: "FAL_API_KEY não configurada." });
        if (!args.base64) return res.status(400).json({ error: "base64 é obrigatório." });

        const ext = (args.mimeType || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
        const uploadRes = await fetch('https://fal.run/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/octet-stream',
            'X-Fal-File-Name': `reference.${ext}`
          },
          body: Buffer.from(args.base64, 'base64')
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          return res.status(uploadRes.status).json({ error: err?.detail || 'Upload failed' });
        }

        const data = await uploadRes.json();
        const url = data?.url || data?.file_url;
        console.log(`[uploadToFal] Uploaded: ${url}`);
        return res.json({ url });
      }

      // --- generateOmniHuman — ByteDance OmniHuman v1.5 via fal.ai ---
      if (method === 'generateOmniHuman') {
        const falKey = process.env.FAL_API_KEY;
        if (!falKey) return res.status(503).json({ error: "FAL_API_KEY não configurada." });

        const omniBody: any = {
          image_url: args.imageUrl,
          audio_url: args.audioUrl,
          resolution: args.resolution || '720p',
          guidance_scale: 1,
          audio_guidance_scale: 2,
        };
        if (args.prompt) omniBody.prompt = args.prompt;

        console.log(`[OmniHuman] image=${args.imageUrl?.substring(0,60)} audio=${args.audioUrl?.substring(0,60)}`);

        const res2 = await withRetry(
          () => fetch('https://fal.run/fal-ai/bytedance/omnihuman/v1.5', {
            method: 'POST',
            headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(omniBody)
          }), 3, 5000, 'generateOmniHuman'
        );
        if (!res2.ok) {
          const err = await res2.json().catch(() => ({}));
          return res.status(res2.status).json({ error: err?.detail || err?.error || 'OmniHuman failed' });
        }
        const data = await res2.json();
        const url = data?.video?.url || data?.url;
        if (url) return res.json({ videoUrl: url, done: true });
        return res.status(500).json({ error: 'OmniHuman não retornou vídeo.' });
      }

      // --- generateAurora — Creatify Aurora via fal.ai ---
      if (method === 'generateAurora') {
        const falKey = process.env.FAL_API_KEY;
        if (!falKey) return res.status(503).json({ error: "FAL_API_KEY não configurada." });

        const auroraBody: any = {
          image_url: args.imageUrl,
          audio_url: args.audioUrl,
          resolution: args.resolution || '720p',
        };
        if (args.prompt) auroraBody.prompt = args.prompt;

        console.log(`[Aurora] image=${args.imageUrl?.substring(0,60)} audio=${args.audioUrl?.substring(0,60)}`);

        const res3 = await withRetry(
          () => fetch('https://fal.run/fal-ai/creatify-aurora', {
            method: 'POST',
            headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(auroraBody)
          }), 3, 5000, 'generateAurora'
        );
        if (!res3.ok) {
          const err = await res3.json().catch(() => ({}));
          return res.status(res3.status).json({ error: err?.detail || err?.error || 'Aurora failed' });
        }
        const data3 = await res3.json();
        const url3 = data3?.video?.url || data3?.url;
        if (url3) return res.json({ videoUrl: url3, done: true });
        return res.status(500).json({ error: 'Aurora não retornou vídeo.' });
      }

      // --- generateSyncLipsync — Sync.so lipsync-2 / lipsync-2-pro via fal.ai ---
      if (method === 'generateSyncLipsync') {
        const falKey = process.env.FAL_API_KEY;
        if (!falKey) return res.status(503).json({ error: "FAL_API_KEY não configurada." });

        const tier = args.tier || 'standard'; // 'standard' | 'pro'
        const endpoint = tier === 'pro'
          ? 'https://fal.run/fal-ai/sync-lipsync/v2/pro'
          : 'https://fal.run/fal-ai/sync-lipsync/v2';

        const syncBody: any = {
          video_url: args.videoUrl,
          audio_url: args.audioUrl,
          sync_mode: args.syncMode || 'cut_off',
          model: tier === 'pro' ? 'lipsync-2-pro' : 'lipsync-2',
        };
        if (args.occlusionDetection) syncBody.occlusion_detection_enabled = true;

        console.log(`[SyncLipsync] tier=${tier} video=${args.videoUrl?.substring(0,60)} audio=${args.audioUrl?.substring(0,60)}`);

        const res4 = await withRetry(
          () => fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(syncBody)
          }), 3, 5000, 'generateSyncLipsync'
        );
        if (!res4.ok) {
          const err = await res4.json().catch(() => ({}));
          return res.status(res4.status).json({ error: err?.detail || err?.error || 'Sync Lipsync failed' });
        }
        const data4 = await res4.json();
        const url4 = data4?.video?.url || data4?.url;
        if (url4) return res.json({ videoUrl: url4, done: true });
        return res.status(500).json({ error: 'Sync Lipsync não retornou vídeo.' });
      }

      // --- generateOmniHuman — ByteDance OmniHuman v1.5 via fal.ai ---
      if (method === 'generateKling') {
        const falKey = process.env.FAL_API_KEY;
        if (!falKey) return res.status(503).json({ error: "FAL_API_KEY não configurada." });

        const tier = args.tier || 'standard'; // 'standard' | 'pro'
        const mode = args.imageUrl ? 'image-to-video' : 'text-to-video';
        const endpoint = `https://fal.run/fal-ai/kling-video/v3/${tier}/${mode}`;

        const klingBody: any = {
          prompt: args.prompt,
          duration: String(args.duration || '5'),  // string conforme docs fal.ai
          aspect_ratio: args.aspectRatio || '16:9',
          cfg_scale: 0.5,
          generate_audio: args.generateAudio !== false,
        };

        if (args.imageUrl) klingBody.image_url = args.imageUrl;
        if (args.negativePrompt) klingBody.negative_prompt = args.negativePrompt;

        console.log(`[Kling3] endpoint=${endpoint} duration=${klingBody.duration}s ratio=${klingBody.aspect_ratio} audio=${klingBody.generate_audio}`);

        const klingRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(klingBody)
        });

        if (!klingRes.ok) {
          const err = await klingRes.json().catch(() => ({ error: klingRes.statusText }));
          console.error("[Kling3] Error:", JSON.stringify(err));
          return res.status(klingRes.status).json({ error: err?.detail || err?.error || 'Kling generation failed' });
        }

        const klingData = await klingRes.json();
        console.log(`[Kling3] Sucesso. Video: ${klingData?.video?.url}`);

        // Kling retorna direto (síncrono no fal.ai)
        if (klingData?.video?.url) {
          return res.json({ videoUrl: klingData.video.url, done: true });
        }

        return res.status(500).json({ error: 'Kling não retornou vídeo válido.' });
      }

      // --- generateSeedance — Seedance 2.0 via fal.ai ---
      if (method === 'generateSeedance') {
        const falKey = process.env.FAL_API_KEY;
        if (!falKey) return res.status(503).json({ error: "FAL_API_KEY não configurada." });

        const tier = args.tier || 'standard';
        const mode = args.imageUrl ? 'image-to-video' : 'text-to-video';
        const modelId = tier === 'fast'
          ? `bytedance/seedance-2.0/fast/${mode}`
          : `bytedance/seedance-2.0/${mode}`;
        const endpoint = `https://fal.run/${modelId}`;

        const seedanceBody: any = {
          prompt: args.prompt,
          duration: String(args.duration || '5'),  // DEVE ser string conforme docs fal.ai
          resolution: '720p',
          aspect_ratio: args.aspectRatio || '16:9',
          generate_audio: args.generateAudio !== false,
          watermark: false,
        };

        if (args.imageUrl) seedanceBody.image_url = args.imageUrl;
        if (args.endImageUrl) seedanceBody.end_image_url = args.endImageUrl;

        console.log(`[Seedance2] endpoint=${endpoint} duration=${seedanceBody.duration}s ratio=${seedanceBody.aspect_ratio} tier=${tier}`);

        const seedanceRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(seedanceBody)
        });

        if (!seedanceRes.ok) {
          const err = await seedanceRes.json().catch(() => ({ error: seedanceRes.statusText }));
          console.error("[Seedance2] Error:", JSON.stringify(err));
          return res.status(seedanceRes.status).json({ error: err?.detail || err?.error || 'Seedance generation failed' });
        }

        const seedanceData = await seedanceRes.json();
        console.log(`[Seedance2] Sucesso. Video: ${seedanceData?.video?.url}`);

        if (seedanceData?.video?.url) {
          return res.json({ videoUrl: seedanceData.video.url, done: true });
        }

        return res.status(500).json({ error: 'Seedance não retornou vídeo válido.' });
      }

       // --- generateVideos (Veo 3.0 via Vertex AI) ---
      if (method === 'generateVideos') {
        const luminaProject = process.env.LUMINA_PROJECT_ID || 'lumina-ai-solutions';
        const oauthToken = await getServiceAccountAccessToken();
        if (!oauthToken) return res.status(503).json({ error: 'OAuth token falhou.' });

        const requestBody: any = {
          instances: [{ prompt: args.prompt }],
          parameters: {
            sampleCount: 1,
            durationSeconds: args.config?.durationSeconds || 4,
            aspectRatio: args.config?.aspectRatio || '9:16',
            resolution: args.config?.resolution || '720p',
            generateAudio: true,
          }
        };
        if (args.image) requestBody.instances[0].image = { bytesBase64Encoded: args.image.imageBytes, mimeType: args.image.mimeType || 'image/jpeg' };
        if (args.audio_input?.prompt) requestBody.parameters.audioPrompt = args.audio_input.prompt;

        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${luminaProject}/locations/us-central1/publishers/google/models/${args.model}:predictLongRunning`;
        console.log(`[Veo] POST ${endpoint} | duration=${requestBody.parameters.durationSeconds}s ratio=${requestBody.parameters.aspectRatio}`);

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 25000);
        let r: Response;
        try {
          r = await fetch(endpoint, { method: 'POST', headers: { 'Authorization': `Bearer ${oauthToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: ctrl.signal });
        } catch (e: any) {
          clearTimeout(t);
          return res.status(504).json({ error: 'Veo timeout ao iniciar.' });
        }
        clearTimeout(t);

        const txt = await r.text();
        console.log(`[Veo] HTTP ${r.status} | ${txt.substring(0, 200)}`);
        if (!r.ok) { let e: any = { error: `HTTP ${r.status}` }; try { e = JSON.parse(txt); } catch {} return res.status(r.status).json(e); }
        return res.json(JSON.parse(txt));

      // --- getVideosOperation (polling Veo) ---
      } else if (method === 'getVideosOperation') {
        const opName = args.operation?.name || args.operation;
        const oauthToken = await getServiceAccountAccessToken();
        const pollUrl = `https://us-central1-aiplatform.googleapis.com/v1/${opName}`;
        console.log(`[Veo Poll] GET ${pollUrl}`);

        const timeout = new Promise<{ timedOut: true }>(res => setTimeout(() => res({ timedOut: true }), 15000));
        const req = fetch(pollUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${oauthToken}` } })
          .then(async r => ({ timedOut: false as const, status: r.status, text: await r.text() }))
          .catch(e => ({ timedOut: false as const, status: 500, text: JSON.stringify({ error: e.message }) }));

        const result = await Promise.race([req, timeout]);
        if ('timedOut' in result && result.timedOut) {
          console.log('[Veo Poll] 15s timeout → done:false');
          return res.json({ done: false, name: opName });
        }

        const { status, text } = result as { timedOut: false, status: number, text: string };
        let data: any = {};
        try { if (text) data = JSON.parse(text); } catch {}
        if (status !== 200) {
          console.error(`[Veo Poll] HTTP ${status}: ${text?.substring(0, 150)}`);
          if (status === 404 || status === 400) return res.json({ done: false, name: opName });
          return res.status(status).json(data);
        }
        console.log(`[Veo Poll] done=${data?.done}`);
        return res.json(data);

      // --- generateImages ---
      } else if (method === 'generateImages') {
        console.log(`[Gemini Proxy] Calling generateImages for ${args.model}`);
        const client = new GoogleGenAI({ apiKey });
        const result = await withRetry(
          () => (client as any).models.generateImages({
            model: args.model,
            prompt: args.prompt,
            config: {
              ...args.config,
              safetySettings: args.config?.safetySettings || defaultSafetySettings
            }
          }),
          3, 3000, 'generateImages'
        );
        return res.json(result);

      // --- generateContent ---
      } else if (method === 'generateContent') {
        const client = new GoogleGenAI({ apiKey });
        const contents = args.contents || [{ role: 'user', parts: [{ text: args.prompt || "" }] }];
        const result = await withRetry(
          () => client.models.generateContent({
            model: args.model,
            contents: contents,
            config: {
              ...args.config,
              safetySettings: args.config?.safetySettings || defaultSafetySettings
            }
          }),
          3, 2000, 'generateContent'
        );
        return res.json({ ...result, text: result.text });

      } else {
        return res.status(400).json({ error: "Invalid method" });
      }

    } catch (error: any) {
      console.error("Gemini API Proxy Exception:", error);

      let errorMessage = error.message || "Erro desconhecido na API Gemini";
      let status = 500;

      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        status = 401;
        errorMessage = "A chave de API configurada é inválida ou expirou.";
      } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
        status = 429;
        errorMessage = "Limite de requisições excedido. Aguarde alguns instantes.";
      } else if (errorMessage.includes("Safety") || errorMessage.includes("blocked")) {
        status = 400;
        errorMessage = "O conteúdo solicitado foi bloqueado pelos filtros de segurança da IA. Tente reformular seu prompt.";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("504")) {
        status = 504;
        errorMessage = "A geração demorou mais que o esperado. Tente novamente.";
      } else if (errorMessage.includes("403") || errorMessage.includes("PERMISSION_DENIED")) {
        status = 403;
        errorMessage = "Sem permissão para usar este recurso. Verifique as configurações da API.";
      }

      res.status(status).json({
        error: errorMessage,
        message: errorMessage,
        details: error.stack?.substring(0, 200)
      });
    }
  });

  // ── Wizard ADS: Geração de prompt via IA ──
  app.post("/api/generate-wizard-prompt", async (req, res) => {
    try {
      const {
        adGoal, adPlatform, wizardProduct, wizardAudience,
        wizardStyle, wizardCta, modelType,
        creativeStrategy, creativeAesthetic, brandContext
      } = req.body;

      if (!wizardProduct?.trim()) {
        return res.status(400).json({ error: "Produto é obrigatório." });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "Serviço de IA indisponível." });
      }

      // ── Motor recomendado por objetivo ──
      const needsTextInImage = false; // Gemini é o motor padrão para ADS
      const recommendedModel = 'nanoBanana'; // Nano Banana 2 — master do Wizard ADS (fallback)

      // ── CTA automático por objetivo se não foi preenchido ──
      const ctaMap: Record<string, string> = {
        conversoes: 'Shop Now — Limited Time Offer',
        lead:       'Get Started Free — Sign Up Today',
        engajamento:'Share This With a Friend',
        awareness:  'Discover More'
      };
      const finalCta = wizardCta?.trim() || ctaMap[adGoal] || 'Learn More';

      // ── Headline automática por objetivo + produto ──
      const headlineMap: Record<string, string> = {
        conversoes: `Get ${wizardProduct} — Best Deal Today`,
        lead:       `Discover ${wizardProduct} — Start Free`,
        engajamento:`Why Everyone Is Talking About ${wizardProduct}`,
        awareness:  `Meet ${wizardProduct}`
      };
      const autoHeadline = headlineMap[adGoal] || wizardProduct;

      const goalMap: Record<string, string> = {
        conversoes: 'Direct Sales & Conversion — urgency, scarcity, strong purchase intent',
        lead:       'Lead Generation — clear value promise, low-friction offer',
        engajamento:'Viral Engagement — emotional hook, shareable, high energy',
        awareness:  'Brand Awareness — aspirational narrative, lifestyle, elegance'
      };
      const platformMap: Record<string, string> = {
        instagram: 'Instagram Feed/Reels — square or portrait, clean composition',
        tiktok:    'TikTok Ads — UGC style, vertical 9:16, authentic energy',
        facebook:  'Facebook Feed Ad — wider format, trust-building layout',
        youtube:   'YouTube Pre-roll — cinematic 16:9, professional authority'
      };
      const styleMap: Record<string, string> = {
        urgencia:     'Urgency — hot colors, extreme contrast, scarcity energy, bold typography',
        elegante:     'Elegant Premium — soft diffused light, neutral tones, minimalist sophistication',
        divertido:    'Playful & Fun — vibrant colors, dynamic composition, youthful energy',
        profissional: 'Corporate Professional — cool blue-grey tones, studio lighting, confident mood',
        luxo:         'Luxury — deep blacks, gold accents, dramatic directional lighting, ultra-premium',
        minimalista:  'Minimalist — white space, single focal point, neutral palette, strong hierarchy'
      };

      const briefing = `
GOAL: ${goalMap[adGoal] || adGoal}
PRODUCT/SERVICE: ${wizardProduct}
TARGET AUDIENCE: ${wizardAudience || 'General adult audience'}
PLATFORM: ${platformMap[adPlatform] || adPlatform}
VISUAL STYLE: ${styleMap[wizardStyle] || wizardStyle || 'Professional'}
HEADLINE TO INCLUDE: "${autoHeadline}"
CTA TO INCLUDE: "${finalCta}"
CREATIVE STRATEGY: ${creativeStrategy || 'Direct Offer'}
AESTHETICS: ${creativeAesthetic || 'Minimalist'}${brandContext ? `\nBRAND CONTEXT: ${brandContext}` : ''}
      `.trim();

      // ── Template de prompt por tipo de motor ──
      const promptTemplate = needsTextInImage
        ? `You are an expert in creating high-conversion advertising prompts for AI image generation with text.

Based on the briefing below, create a detailed prompt in ENGLISH for a professional advertising image using Ideogram (which renders text accurately).

BRIEFING:
${briefing}

MANDATORY RULES:
- The PRODUCT/SERVICE is the main visual hero — largest, sharpest, most lit element
- Include the HEADLINE text prominently in the composition: bold, large, readable font
- Include the CTA text as a visible button or banner element
- If there is a person/persona reference, they are SUPPORT — interact with the product without dominating
- Describe: scene, lighting, composition, color palette, depth of field, text placement and font style
- Include technical references (lighting type, lens, color grade)
- Output in Ideogram prompt style: describe text elements with quotes and placement
- DO NOT include meta-comments, only the final prompt
- DO NOT start with "A" or "An"

Return ONLY the prompt, no explanations.`
        : `You are an expert in creating high-conversion advertising prompts for AI image generation.

Based on the briefing below, create a detailed prompt in ENGLISH for a professional advertising image.

BRIEFING:
${briefing}

MANDATORY RULES:
- The PRODUCT/SERVICE is the main visual hero — largest, sharpest, most lit element
- If there is a person/persona reference, they are SUPPORT — appear in background or interact with product
- Describe: scene, lighting, composition, color palette, depth of field and mood
- Include technical references (lighting type, lens, color grade)
- NO text in image, NO logos or watermarks
- DO NOT include meta-comments, only the final prompt
- DO NOT start with "A" or "An" — start with the main visual element (the product)

Return ONLY the prompt, no explanations.`;

      const client = new GoogleGenAI({ apiKey });
      const result = await withRetry(
        () => client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: promptTemplate }] }]
        }),
        2, 2000, 'generateWizardPrompt'
      );

      const text = result.text?.trim() || '';
      if (!text) throw new Error('Empty AI response');

      console.log(`[WizardPrompt] goal=${adGoal} model=${recommendedModel} cta="${finalCta}" product="${wizardProduct.substring(0, 30)}"`);
      return res.json({ prompt: text, recommendedModel });

    } catch (error: any) {
      console.error("[WizardPrompt] Error:", error.message);

      const { wizardProduct = 'product', wizardAudience = '', adPlatform = 'instagram', wizardStyle = '', adGoal = 'conversoes', wizardCta = '' } = req.body;
      const recModel = 'nanoBanana'; // Nano Banana 2 sempre
      const ctaFallback = wizardCta || (adGoal === 'conversoes' ? 'Compre Agora — Oferta Limitada' : adGoal === 'lead' ? 'Cadastre-se Grátis' : 'Saiba Mais');

      const fallback = `${wizardProduct} as the central visual hero, dramatically lit, sharply focused, ${
          wizardStyle === 'elegante'    ? 'soft diffused light, neutral premium palette, sophisticated minimalist composition.' :
          wizardStyle === 'urgencia'    ? 'warm saturated colors, bold contrast, kinetic urgency, strong visual hierarchy.' :
          wizardStyle === 'luxo'        ? 'deep blacks, golden accents, dramatic directional light, ultra-premium feel.' :
          wizardStyle === 'divertido'   ? 'vibrant colors, playful composition, dynamic energy, lifestyle aesthetic.' :
          wizardStyle === 'profissional'? 'cool blue-grey tones, studio lighting, confident professional mood.' :
                                          'clean composition, balanced lighting, sharp focus, modern aesthetic.'
        } Cinematic depth of field, 8K detail, no text or logos.`;

      return res.json({ prompt: fallback, recommendedModel: recModel });
    }
  });

  // Proxy for video files
  app.get("/api/proxy-video", async (req, res) => {
    try {
      let { url } = req.query;
      if (!url) return res.status(400).json({ error: "URL is required" });

      let targetUrl = url as string;

      if (targetUrl.includes("generativelanguage.googleapis.com")) {
        const oauthToken = await getServiceAccountAccessToken();
        if (oauthToken) {
          const response = await fetch(targetUrl, {
            headers: { 'Authorization': `Bearer ${oauthToken}` }
          });
          if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
          const contentType = response.headers.get("content-type");
          if (contentType) res.setHeader("Content-Type", contentType);
          const buffer = await response.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }
        
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (apiKey) {
          const separator = targetUrl.includes("?") ? "&" : "?";
          targetUrl = `${targetUrl}${separator}key=${apiKey.trim()}`;
        }
      }

      console.log(`[Proxy] Fetching video from: ${targetUrl.split('?')[0]}...`);
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText} (${response.status})`);

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Proxy Video Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("[Startup] Failed to initialize Vite middleware:", e);
    }
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Runtime Error]:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  return app;
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] thrown:', err);
});

const appPromise = createServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};

if (!process.env.VERCEL) {
  appPromise.then(app => {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  });
}
