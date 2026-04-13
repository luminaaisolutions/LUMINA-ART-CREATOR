import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, contents, model = "gemini-3-flash-preview", config } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured on server." });
      }

      const genAI = new (GoogleGenAI as any)(apiKey);
      const modelInstance = genAI.getGenerativeModel({ model });

      if (model.includes('imagen')) {
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

      const result = await modelInstance.generateContent({
        contents: contents || [{ text: prompt }],
        generationConfig: config
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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
      
      const genAI = new (GoogleGenAI as any)(apiKey);
      const modelInstance = genAI.getGenerativeModel({ model });

      // @ts-ignore
      const operation = await modelInstance.generateVideos({
        prompt,
        config,
        image,
        audio_input
      });

      res.json(operation);
    } catch (error: any) {
      console.error("Video Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/get-operation", async (req, res) => {
    try {
      const { operation } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured." });

      const genAI = new (GoogleGenAI as any)(apiKey);
      
      // @ts-ignore
      const result = await genAI.operations.getVideosOperation({ operation });
      res.json(result);
    } catch (error: any) {
      console.error("Operation Polling Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/proxy-video", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).send("URL required");
      
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(url as string, {
        headers: { 'x-goog-api-key': apiKey! }
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
