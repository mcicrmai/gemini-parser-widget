import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt =
      "Extract name, email, phone, and skills from this resume. Return ONLY a JSON object.";

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type } },
    ]);

    const response = await result.response;
    let text = response.text().trim();

    // Safety check: Remove potential markdown formatting
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      return NextResponse.json(JSON.parse(text));
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", text);
      return NextResponse.json(
        { error: "Invalid JSON from AI", raw: text },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("Vercel API Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
