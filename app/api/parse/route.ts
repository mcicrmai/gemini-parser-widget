import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const MODEL_CHAIN = [
  "gemini-2.0-flash-001",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite-001",
];
const PROMPT = `
  You are a specialized Singapore Recruitment Parser. Extract data from this resume.
  RULES:
  1. Nationality: Use country name EXCEPT for "Singaporean" or "Malaysian".
  2. Residency: Must be one of: [Citizen, Permanent Resident, Work Permit, S Pass, Employment Pass, Long Term Visit Pass, Student Pass, Dependant Pass].
  3. Qualification: Must be one of: [O Level, A Level, Nitec, Higher Nitec, Diploma, Bachelor's Degree, Master's Degree, PhD, Professional Certificate, Others].
  4. Skills & Languages: Return as a comma-separated string.

  RETURN ONLY A VALID JSON OBJECT WITH THIS EXACT STRUCTURE:
  {
    "Name": "",
    "DateOfBirth": "",
    "Age": "",
    "Gender": "Male/Female",
    "Race": "Chinese/Malay/Indian/Others",
    "Nationality": "",
    "Residency": "",
    "NoticePeriod": "",
    "Mobile": "",
    "Email": "",
    "ProfileSummary": "",
    "Languages": "",
    "Skills": "",
    "LastDrawnSalary": "",
    "ExpectedSalary": "",
    "NearestMRTStation": "",
    "Education": [
      { "School": "", "Qualification": "", "Major": "", "Summary": "", "From": "", "To": "" }
    ],
    "WorkExperience": [
      { "Company": "", "JobTitle": "", "Summary": [{ "Description": "" }], "LeavingReason": "", "From": "", "To": "" }
    ],
    "Address": { "PostalCode": "", "Floor": "", "UnitNumber": "" },
    "OtherInformation": ""
  }
`;

async function tryModelWithRetry(
  modelName: string,
  base64Data: string,
  mimeType: string,
  maxRetries = 3,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelName });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent([
        PROMPT,
        { inlineData: { data: base64Data, mimeType } },
      ]);
      return result.response.text();
    } catch (error: unknown) {
      const is503 =
        error instanceof Error &&
        (error.message.includes("503") ||
          error.message.includes("Service Unavailable") ||
          error.message.includes("high demand"));

      const isLastAttempt = attempt === maxRetries - 1;

      if (!is503 || isLastAttempt) throw error;

      const delayMs = 1000 * 2 ** attempt; // 1s → 2s → 4s
      console.warn(
        `[${modelName}] 503 on attempt ${attempt + 1}, retrying in ${delayMs}ms...`,
      );
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }

  throw new Error(`Exhausted retries for ${modelName}`);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    let rawText: string | null = null;
    let usedModel: string | null = null;
    let lastError: unknown;

    for (const modelName of MODEL_CHAIN) {
      try {
        console.log(`Trying model: ${modelName}`);
        rawText = await tryModelWithRetry(modelName, base64Data, file.type);
        usedModel = modelName;
        console.log(`Success with model: ${modelName}`);
        break;
      } catch (error: unknown) {
        console.warn(`Model ${modelName} failed:`, error);
        lastError = error;
      }
    }

    if (!rawText) {
      const msg =
        lastError instanceof Error ? lastError.message : "All models failed";
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    const cleanText = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanText);

    return NextResponse.json({ ...parsed, _model: usedModel });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
