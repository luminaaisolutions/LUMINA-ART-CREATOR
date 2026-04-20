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

// Helper: get OAuth2 access token from service account for Vertex AI
async function getServiceAccountAccessToken(): Promise<string | null> {
  try {
    const serviceAccount = serviceAccountCredentials || 
      (process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null);
    
    if (!serviceAccount) {
      console.warn("[Auth] No service account found for OAuth token");
      return null;
    }

    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token || null;
  } catch (e: any) {
    console.error("[Auth] Failed to get service account token:", e.message);
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

      // --- generateVideos via REST API with OAuth (Service Account) ---
      if (method === 'generateVideos') {
        console.log(`[Gemini Proxy] Calling generateVideos for ${args.model} via REST`);
        
        // Try OAuth token first (service account), fallback to API key
        const oauthToken = await getServiceAccountAccessToken();
        
        let videoResponse;
        
        if (oauthToken) {
          console.log("[Gemini Proxy] Using OAuth token for video generation");
          
          const requestBody: any = {
            prompt: args.prompt,
            config: {
              numberOfVideos: args.config?.numberOfVideos || 1,
              durationSeconds: args.config?.durationSeconds || 4,
              aspectRatio: args.config?.aspectRatio || '9:16',
              resolution: args.config?.resolution || '720p'
            }
          };

          if (args.image) requestBody.image = args.image;
          if (args.audio_input) requestBody.audio_input = args.audio_input;

          videoResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateVideos`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${oauthToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            }
          );
        } else {
          console.log("[Gemini Proxy] OAuth failed, using API key for video generation");
          const client = new GoogleGenAI({ apiKey });
          const result = await withRetry(
            () => (client as any).models.generateVideos({
              model: args.model,
              prompt: args.prompt,
              config: {
                ...args.config,
                safetySettings: undefined // Remove safetySettings for Veo
              },
              image: args.image,
              audio_input: args.audio_input
            }),
            3, 5000, 'generateVideos'
          );
          return res.json(result);
        }

        const videoRawText = await videoResponse.text();
        console.log(`[Gemini Proxy] Video response status: ${videoResponse.status}`);
        console.log(`[Gemini Proxy] Video response body: ${videoRawText.substring(0, 500)}`);

        if (!videoRawText || videoRawText.trim() === "") {
          return res.status(500).json({ error: "API retornou resposta vazia.", message: "Tente novamente." });
        }

        let videoData;
        try {
          videoData = JSON.parse(videoRawText);
        } catch (e) {
          return res.status(500).json({ error: "Resposta invalida da API", raw: videoRawText.substring(0, 200) });
        }

        if (!videoResponse.ok) {
          console.error("[Gemini Proxy] Video generation error:", JSON.stringify(videoData));
          return res.status(videoResponse.status).json(videoData);
        }

        return res.json(videoData);

      // --- getVideosOperation (polling) ---
      } else if (method === 'getVideosOperation') {
        const opName = args.operation?.name || args.operation;
        console.log(`[Gemini Proxy] Getting operation status: ${opName}`);
        
        const oauthToken = await getServiceAccountAccessToken();
        
        let pollResponse;
        if (oauthToken) {
          pollResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${opName}`,
            {
              headers: {
                'Authorization': `Bearer ${oauthToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${apiKey}`;
          pollResponse = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
        }
        
        const data = await pollResponse.json();
        if (!pollResponse.ok) return res.status(pollResponse.status).json(data);
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
