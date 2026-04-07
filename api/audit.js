// api/audit.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { companyName } = req.body;
  if (!companyName) return res.status(400).json({ error: 'Company name is required' });

  // Securely retrieve the API key from Vercel
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const vectorSchema = { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, amount: { type: "NUMBER" }, range: { type: "STRING" }, pct: { type: "NUMBER" } } } };
  const itemSchema = { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, detail: { type: "STRING" }, type: { type: "STRING" }, provider: { type: "STRING" }, spend: { type: "NUMBER" }, waste: { type: "NUMBER" }, wastePct: { type: "NUMBER" } } } };
  const catSchema = { type: "OBJECT", properties: { wasteAmount: { type: "NUMBER" }, note: { type: "STRING" }, vectors: vectorSchema, platforms: itemSchema, items: itemSchema, services: itemSchema } };
  
  const auditResponseSchema = {
    type: "OBJECT",
    properties: {
      companyName: { type: "STRING" }, companyType: { type: "STRING" }, totalWaste: { type: "NUMBER" }, overallWastePct: { type: "NUMBER" },
      confidence: { type: "STRING" }, rangeText: { type: "STRING" }, summary: { type: "STRING" }, bestFirstAudit: { type: "STRING" }, bestFirstReason: { type: "STRING" },
      categories: { type: "OBJECT", properties: { adid: catSchema, shipid: catSchema, paymentid: catSchema, kloudid: catSchema, seatid: catSchema } }
    }
  };

  const prompt = `You are Vaudit's AI spend intelligence engine. Run a simulated diagnostic on: "${companyName}".
IMPORTANT: Maintain an authoritative, analytical tone. Frame output as "based on heuristics and comparable benchmarks."
Create a realistic monthly spend waste audit. Infer their industry, size, and likely vendor stack based on the name/URL.
Generate realistic, substantial numbers for totalWaste, overallWastePct (between 10 and 35), and detailed category breakdowns. Ensure category wasteAmounts sum roughly to totalWaste. Return ONLY valid JSON matching the schema.`;

  try {
    const response = await fetch(url, { 
      method: "POST", headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: auditResponseSchema } }) 
    });
    const data = await response.json();
    return res.status(200).json(JSON.parse(data.candidates[0].content.parts[0].text));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate audit data' });
  }
}
