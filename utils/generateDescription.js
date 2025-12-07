import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || null,
});

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY — Set it in .env");
}


export const generateFAQ = async ({ projectName, features, location }) => {
  const prompt = `
Generate a bullet-point list answering the question:

"Why should someone consider ${projectName}?"

Details to consider:
- Location: ${location}
- Key amenities/features: ${features.join(", ")}

Output rules:
- 1 question string
- Answer MUST be an array of short bullet points (not long sentences)
- No numbering
- Format output as pure JSON array of strings.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
};

export const generateDescription = async ({
    projectName,
    location,
    rera,
    amenities,
    features
}) => {
    const prompt = `Generate a professional real estate description.

Project Name: ${projectName}
Location: ${location}
RERA No.: ${rera ? rera : "Not available"}
Amenities: ${amenities?.length ? amenities.join(", ") : "Not specified"}
Features: ${features?.length ? features.join(", ") : "Not specified"}

Rules:
- Write 2 short marketing paragraphs.
- Mention that it's RERA registered only if RERA number exists.
- Tone should be clean and professional.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
};