import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;

async function checkHealth() {
  if (!apiKey) return console.log("No API key");
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const res = await model.generateContent("Ping");
    console.log("Gemini API connection healthy:", res.response.text().trim());
  } catch (e: any) {
    console.error("Gemini test failed:", e.message);
  }
}

checkHealth();

