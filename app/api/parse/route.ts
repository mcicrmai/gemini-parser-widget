import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    const prompt = `
      You are a specialized Singapore Recruitment Parser. Extract data from this resume.
      RULES:
      1. Nationality: Use country name (e.g., India) EXCEPT for "Singaporean" or "Malaysian".
      2. Residency: Must be one of: [Citizen, Permanent Resident, Work Permit, S Pass, Employment Pass, Long Term Visit Pass, Student Pass, Dependant Pass].
      3. Qualification: Must be one of: [O Level, A Level, Nitec, Higher Nitec, Diploma, Bachelor's Degree, Master's Degree, PhD, Professional Certificate, Others].
      4. Skills \u0026 Languages: Return as a comma-separated string, not an array.

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

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type } },
    ]);

    const cleanText = result.response
      .text()
      .replace(/\`\`\`json|\`\`\`/g, "")
      .trim();
    return NextResponse.json(JSON.parse(cleanText));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
