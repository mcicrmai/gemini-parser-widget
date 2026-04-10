import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// 1. Initialize Gemini with your Paid Tier Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET() {
  return NextResponse.json({
    message: "Engine is Online. Use POST to upload.",
  });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 2. Prepare file data for Gemini
    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    // 3. Use the latest Flash alias (Fixes the 404 error)
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
      Extract info from this resume. Return ONLY a JSON object with: 
      { "name": "", "email": "", "phone": "", "skills": [], "summary": "" }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
    ]);

    const response = await result.response;

    // 4. Clean and parse JSON securely
    const cleanText = response
      .text()
      .replace(/```json|```/g, "")
      .trim();

    return NextResponse.json(JSON.parse(cleanText));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Error";
    console.error("API Error:", errorMessage);
    return NextResponse.json(
      { error: "Parsing failed", details: errorMessage },
      { status: 500 },
    );
  }
}
