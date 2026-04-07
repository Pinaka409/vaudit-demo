// api/audit.js
module.exports = async function handler(req, res) {
  // 1. Enable CORS (prevents cross-origin blocking issues)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // 2. Validate the incoming request
    const { companyName } = req.body || {};
    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    // 3. Securely check for the API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key is missing in Vercel settings. Please add GEMINI_API_KEY.' });
    }

    // 4. Use the stable production Gemini endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 5. Define the exact JSON structure we need back
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

    // 6. Call the Gemini API
    const response = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }], 
        generationConfig: { 
            responseMimeType: "application/json", 
            responseSchema: auditResponseSchema 
        } 
      }) 
    });
    
    // 7. Handle Google-specific errors (e.g., bad API key, quota exceeded)
    if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ error: `Google API Error (${response.status}): ${errorText}` });
    }

    const data = await response.json();

    // 8. Handle malformed responses
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        return res.status(500).json({ error: `Invalid response format from Google: ${JSON.stringify(data)}` });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    return res.status(200).json(JSON.parse(rawText));
    
  } catch (error) {
    // 9. Catch any other unexpected server crashes
    return res.status(500).json({ error: `Server crash: ${error.message}` });
  }
}
