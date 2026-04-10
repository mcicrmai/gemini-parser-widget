import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// 1. Initialize Gemini with your secret key from Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 2. GET method so you can test the URL in a browser
export async function GET() {
  return NextResponse.json({
    status: "online",
    message: "Gemini Parser Engine is running. Use POST to upload a file.",
  });
}

// 3. POST method for the actual resume parsing
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert file to Base64 for Gemini
    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    // Use Gemini 2.0 Flash (Fastest for Paid Tier)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      Extract the following from this resume: name, email, phone, skills (array), and summary.
      Return ONLY a clean JSON object. No markdown, no extra text.
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
    let text = response.text();

    // Clean the text to ensure it's valid JSON
    text = text.replace(/```json|```/g, "").trim();

    return NextResponse.json(JSON.parse(text));
  } catch (error: unknown) {
    // FIXES THE "UNEXPECTED ANY" ERROR
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("API Error:", errorMessage);

    return NextResponse.json(
      { error: "Parsing failed", details: errorMessage },
      { status: 500 },
    );
  }
}
