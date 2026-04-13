import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function checkApi() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });
  console.log("ai.models.generateVideos:", typeof ai.models.generateVideos);
  // We can't easily inspect the parameters at runtime without calling it,
  // but we can try to see if it's defined.
}

checkApi();
