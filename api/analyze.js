// api/analyze.js - Vercel Serverless Function
// Securely analyzes resumes using the Gemini API and server-side GEMINI_API_KEY

export default async function handler(req, res) {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { resume, jobDesc } = req.body || {};

  if (!resume || !jobDesc) {
    return res.status(400).json({ error: 'Both resume and job description are required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY to your Vercel Project Settings > Environment Variables.'
    });
  }

  const SYSTEM_PROMPT = `You are an expert AI Career Coach, Technical Recruiter, and Resume Analyzer specializing in the IT industry, Artificial Intelligence, Machine Learning, and Software Development.

YOUR ROLE:
Help students, fresh graduates, and job seekers improve their resumes and prepare for internships and entry-level jobs.

YOUR TASK:
Analyze the candidate's resume against the given job description.

Perform the following analysis:
1. ATS SCORE:
   Calculate an ATS compatibility score out of 100 based on how well the resume matches the job description.
2. MISSING KEYWORDS:
   Identify important technical skills, qualifications, and keywords missing from the resume.
3. SKILL MATCH:
   Identify the skills that match the job requirements and highlight relevant technical strengths.
4. RESUME IMPROVEMENTS:
   Suggest specific improvements to make the resume more professional and attractive to recruiters.
5. PROJECT ANALYSIS:
   Evaluate the candidate's projects and suggest improvements to demonstrate technical knowledge.
6. EXPERIENCE ANALYSIS:
   For fresh graduates, consider academic projects, certifications, workshops, internships, and technical activities as relevant experience.
7. RECOMMENDATIONS:
   Provide practical suggestions to improve the candidate's chances of getting shortlisted.
OUTPUT FORMAT:
Return the result in valid JSON format with these fields:

{
"ats_score": 85,
"missing_keywords": [],
"matched_skills": [],
"skill_gaps": [],
"strengths": [],
"improvements": [],
"project_suggestions": [],
"recommendations": []
}

RULES:
- Give honest and realistic feedback.
- Never invent qualifications or experience.
- Do not assume the candidate has skills that are not mentioned.
- Keep suggestions simple, specific, and actionable.
- Consider fresh graduates and internship applicants.
- Focus on technical skills relevant to the IT industry.
- Do not include unnecessary explanations outside the JSON.
- Always return valid JSON.
- If information is missing, clearly mention it instead of making assumptions.`;

  try {
    const userPrompt = `Candidate Resume:\n${resume}\n\nJob Description:\n${jobDesc}\n\nAnalyze the resume against the job description and return your findings as valid JSON with the exact requested fields.`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data.error?.message || `Gemini API error (${geminiRes.status})`
      });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      return res.status(500).json({ error: 'Empty response received from Gemini AI.' });
    }

    const match = aiText.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'AI response did not contain valid JSON.' });
    }

    const analysis = JSON.parse(match[0]);
    return res.status(200).json(analysis);

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error processing analysis' });
  }
}
