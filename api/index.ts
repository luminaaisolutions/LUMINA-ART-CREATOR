import express from "express";
import path from "path";
import { fileURLToPath } from "url";

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

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  console.log("=== SERVER STARTUP ===");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("VERCEL:", process.env.VERCEL);
  
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  console.log("Gemini Key status:", geminiKey ? "Defined" : "Undefined");
  if (geminiKey) {
    console.log("Gemini Key starts with:", geminiKey.substring(0, 5));
  }
  console.log("======================");

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Lumina API is running" });
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
      
      // Only try to find another key if NO key was provided at all
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
