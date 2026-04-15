import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import admin from 'firebase-admin';

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
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0723352507'
  });
}
const dbAdmin = admin.firestore();

// Initialize Mercado Pago
const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
  options: { timeout: 5000 }
});

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  console.log("=== SERVER STARTUP ===");
  // ... (rest of the logs)
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("VERCEL:", process.env.VERCEL);
  
  // Log available keys (masked for security)
  const possibleKeys = ['GEMINI_API_KEY', 'API_KEY', 'GOOGLE_API_KEY', 'VITE_GEMINI_API_KEY'];
  possibleKeys.forEach(k => {
    const val = process.env[k];
    if (val) {
      console.log(`Env Var ${k}: Present, starts with "${val.substring(0, 4)}", length: ${val.length}`);
    } else {
      console.log(`Env Var ${k}: Not found`);
    }
  });
  
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  console.log("Final Gemini Key to use starts with:", geminiKey ? geminiKey.substring(0, 4) : "NONE");
  console.log("======================");

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Lumina API is running" });
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
          payer: {
            email: userEmail
          },
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
      const { type, data } = req.body;
      console.log(`[MercadoPago Webhook] Type: ${type}, Data ID: ${data?.id}`);

      if (type === 'payment') {
        const payment = new Payment(mpClient);
        const paymentData = await payment.get({ id: data.id });

        if (paymentData.status === 'approved') {
          const { user_id, plan_name, credits } = paymentData.metadata;
          
          console.log(`[MercadoPago Webhook] Payment Approved! User: ${user_id}, Credits: ${credits}`);

          // Update user credits in Firestore
          const userRef = dbAdmin.collection('users').doc(user_id);
          await dbAdmin.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error("User not found");
            
            const currentCredits = userDoc.data()?.credits || 0;
            transaction.update(userRef, {
              credits: currentCredits + Number(credits),
              plan: plan_name.toLowerCase()
            });

            // Log payment
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

  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      console.log(`[MOCK EMAIL] Enviando código ${code} para ${email}`);
      // Em produção, aqui usaria Resend, SendGrid ou similar.
      res.json({ success: true, message: "Código enviado com sucesso (simulado)" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/proxy-video", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).send("URL required");
      
      let apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY)?.trim()?.replace(/['"]/g, '');
      
      if (!apiKey) {
        const foundKey = Object.values(process.env).find(v => typeof v === 'string' && v.startsWith('AIza'));
        if (foundKey) apiKey = foundKey;
      }

      if (!apiKey) {
        return res.status(400).send("API Key ausente nas variáveis de ambiente.");
      }
      const response = await fetch(url as string, {
        headers: { 'x-goog-api-key': apiKey }
      });
      
      if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
      
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('content-type', contentType);
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/gemini", async (req, res) => {
    try {
      const { method, args } = req.body;
      
      // Priority 1: GEMINI_API_KEY (Official name)
      // Priority 2: GOOGLE_API_KEY (Common name)
      // Priority 3: API_KEY (Generic name)
      let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
      
      apiKey = apiKey?.trim()?.replace(/['"]/g, '');
      
      // Validation: If the key doesn't look like a Gemini key (AIza...), 
      // check if there's a better one in the environment.
      if (!apiKey || (!apiKey.startsWith('AIza') && !apiKey.startsWith('AQ.'))) {
        const betterKey = Object.values(process.env).find(v => 
          typeof v === 'string' && v.startsWith('AIza')
        );
        if (betterKey) apiKey = betterKey.trim().replace(/['"]/g, '');
      }

      if (!apiKey) {
        console.error("ERRO: Nenhuma chave de API válida encontrada.");
        return res.status(400).json({ error: "API Key ausente ou inválida no servidor." });
      }

      console.log(`[Gemini Proxy] Usando chave: ${apiKey.substring(0, 6)}... (Total: ${apiKey.length} chars)`);

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      let result;
      if (method === 'generateContent') {
        try {
          const response = await ai.models.generateContent({
            model: args.model,
            contents: args.contents,
            config: args.config
          });
          
          // Extract serializable data from the response
          res.json({
            candidates: response.candidates?.map(c => ({
              content: c.content,
              finishReason: c.finishReason,
              index: c.index,
              safetyRatings: c.safetyRatings
            })),
            text: response.text,
            usageMetadata: response.usageMetadata
          });
        } catch (error: any) {
          if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
            console.error("Gemini API 403 Error: Service might be blocked or API Key restricted.");
            return res.status(403).json({ 
              error: "ACESSO NEGADO: Sua chave de API do Gemini pode não ter a 'Generative Language API' ativada ou está bloqueada para este serviço. Verifique as configurações no Google Cloud Console.",
              details: error.message 
            });
          }
          throw error;
        }
      } else if (method === 'generateImages') {
        try {
          // @ts-ignore
          const response = await ai.models.generateImages({
            model: args.model,
            prompt: args.prompt,
            config: args.config
          });
          
          // Extract serializable data from the response
          res.json({
            generatedImages: response.generatedImages?.map(img => ({
              image: {
                imageBytes: img.image.imageBytes,
                mimeType: img.image.mimeType
              }
            }))
          });
        } catch (error: any) {
          if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
            return res.status(403).json({ 
              error: "ACESSO NEGADO: Sua chave de API do Gemini pode não ter a 'Generative Language API' ativada ou está bloqueada para este serviço (Imagen).",
              details: error.message 
            });
          }
          throw error;
        }
      } else if (method === 'generateVideos') {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateVideos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            prompt: args.prompt,
            videoConfig: args.config,
            image: args.image,
            // Handle both possible naming conventions for audio input
            audioConfig: args.audio_input || args.audioConfig,
            audio_input: args.audio_input || args.audioConfig
          })
        });
        const data = await response.json();
        if (!response.ok) {
          console.error("Veo API Error:", data);
          if (response.status === 403) {
            return res.status(403).json({ 
              error: "ACESSO NEGADO: Sua chave de API do Gemini pode não ter a 'Generative Language API' ativada ou está bloqueada para este serviço (Veo).",
              details: data 
            });
          }
          return res.status(response.status).json(data);
        }
        res.json(data);
      } else if (method === 'getVideosOperation') {
        const opName = args.operation.name || args.operation;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opName}`, {
          headers: { 'x-goog-api-key': apiKey }
        });
        const data = await response.json();
        if (!response.ok) {
          console.error("Veo Operation Error:", data);
          if (response.status === 403) {
            return res.status(403).json({ 
              error: "ACESSO NEGADO: Sua chave de API do Gemini pode não ter a 'Generative Language API' ativada ou está bloqueada.",
              details: data 
            });
          }
          return res.status(response.status).json(data);
        }
        res.json(data);
      } else {
        res.status(400).json({ error: "Método não suportado" });
      }
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      // Ensure we always return JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ 
        error: "Erro interno no servidor de proxy do Gemini.",
        details: error.message || String(error)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

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
