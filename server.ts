import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createGoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  console.log("=== SERVER STARTUP ===");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("VERCEL:", process.env.VERCEL);
  console.log("GEMINI_API_KEY status:", process.env.GEMINI_API_KEY ? "Defined" : "Undefined");
  if (process.env.GEMINI_API_KEY) {
    console.log("GEMINI_API_KEY start:", process.env.GEMINI_API_KEY.substring(0, 5));
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

  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, contents, model = "gemini-1.5-flash", config } = req.body;
      
      let apiKey = process.env.GEMINI_API_KEY?.trim()?.replace(/['"]/g, '');
      
      // AUTO-RECOVERY: Busca por uma chave válida no ambiente caso a principal falhe
      if (!apiKey || !apiKey.startsWith('AIza')) {
        const foundKey = Object.values(process.env).find(v => typeof v === 'string' && v.startsWith('AIza'));
        if (foundKey) apiKey = foundKey;
      }

      if (!apiKey || apiKey.length < 10 || !apiKey.startsWith('AIza')) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY inválida ou não configurada. Se estiver no Vercel, adicione-a no Dashboard do projeto." 
        });
      }

      // Diagnostic log (masked)
      console.log(`Using API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)} (Length: ${apiKey.length})`);

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelInstance = genAI.getGenerativeModel({ model });

      if (model.includes('imagen') || model.includes('image-preview')) {
        // @ts-ignore
        const result = await modelInstance.generateImages({
          prompt,
          config
        });
        const image = result.generatedImages[0].image;
        return res.json({ 
          text: "", 
          inlineData: { 
            data: image.imageBytes, 
            mimeType: "image/png" 
          } 
        });
      }

      const { safetySettings, tools, ...generationConfig } = config || {};

      // Normalize contents to Content[] format strictly
      let formattedContents: any[] = [];
      if (contents) {
        const contentsArray = Array.isArray(contents) ? contents : [contents];
        formattedContents = contentsArray.map((c: any) => {
          // If it's already a valid Content object with parts and role
          if (c.parts && Array.isArray(c.parts) && c.role) return c;
          
          // If it has parts but no role, add role: 'user'
          if (c.parts && Array.isArray(c.parts)) return { role: 'user', ...c };
          
          // If it's a part object (has text or inlineData), wrap it
          if (c.text || c.inlineData) return { role: 'user', parts: [c] };
          
          // Fallback: treat as text
          return { role: 'user', parts: [{ text: String(c) }] };
        });
      } else {
        formattedContents = [{ role: 'user', parts: [{ text: prompt }] }];
      }

      const result = await modelInstance.generateContent({
        contents: formattedContents,
        generationConfig,
        safetySettings,
        tools
      });

      const response = await result.response;
      const text = response.text();
      
      // Handle inlineData if present in response (for image generation models)
      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        const parts = candidates[0].content.parts;
        const inlineData = parts.find(p => p.inlineData);
        if (inlineData) {
          return res.json({ text, inlineData: inlineData.inlineData });
        }
      }

      res.json({ text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/generate-video", async (req, res) => {
    try {
      const { model, prompt, config, image, audio_input } = req.body;
      let apiKey = process.env.GEMINI_API_KEY?.trim()?.replace(/['"]/g, '');
      
      if (!apiKey || !apiKey.startsWith('AIza')) {
        const foundKey = Object.values(process.env).find(v => typeof v === 'string' && v.startsWith('AIza'));
        if (foundKey) apiKey = foundKey;
      }

      if (!apiKey || apiKey.length < 10 || !apiKey.startsWith('AIza')) {
        console.error("Video Generation Error: API Key missing or invalid");
        return res.status(500).json({ error: "GEMINI_API_KEY inválida ou não configurada no servidor." });
      }
      
      // Use the correct SDK for video generation
      const client = createGoogleGenAI({ apiKey });
      
      // @ts-ignore
      const operation = await client.models.generateVideos(model, {
        prompt,
        ...config,
        image,
        audio_input
      });

      res.json(operation);
    } catch (error: any) {
      console.error("Video Generation Error:", error);
      res.status(500).json({ error: error.message || "Erro ao iniciar geração de vídeo" });
    }
  });

  app.post("/api/get-operation", async (req, res) => {
    try {
      const { operation } = req.body;
      let apiKey = process.env.GEMINI_API_KEY?.trim()?.replace(/['"]/g, '');
      
      if (!apiKey || !apiKey.startsWith('AIza')) {
        const foundKey = Object.values(process.env).find(v => typeof v === 'string' && v.startsWith('AIza'));
        if (foundKey) apiKey = foundKey;
      }

      if (!apiKey || apiKey.length < 10 || !apiKey.startsWith('AIza')) {
        return res.status(500).json({ error: "GEMINI_API_KEY inválida ou não configurada." });
      }

      const client = createGoogleGenAI({ apiKey });
      
      // @ts-ignore
      const result = await client.operations.get(operation.name || operation.id || operation);
      res.json(result);
    } catch (error: any) {
      console.error("Operation Polling Error:", error);
      res.status(500).json({ error: error.message || "Erro ao consultar status da operação" });
    }
  });

  app.get("/api/proxy-video", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).send("URL required");
      
      let apiKey = process.env.GEMINI_API_KEY?.trim()?.replace(/['"]/g, '');
      
      if (!apiKey || !apiKey.startsWith('AIza')) {
        const foundKey = Object.values(process.env).find(v => typeof v === 'string' && v.startsWith('AIza'));
        if (foundKey) apiKey = foundKey;
      }

      if (!apiKey || !apiKey.startsWith('AIza')) {
        return res.status(400).send("API Key inválida ou ausente.");
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
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  });
}
