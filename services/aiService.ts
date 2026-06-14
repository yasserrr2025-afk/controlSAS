// c:\Users\Azzam\Desktop\newcontrol\services\aiService.ts

// OpenRouter Free Models in order of preference
const AI_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen3-coder:free'
];

export interface AiInsightsResult {
  metrics: {
    title: string;
    value: string;
    status: 'success' | 'warning' | 'danger' | 'info';
  }[];
  insights: string[];
}

export const fetchAIAnalysis = async (
  apiKey: string,
  dataContext: any,
  analysisType: 'absence' | 'proctor' | 'receipt' | 'errors' | 'predictive' | 'auditor'
): Promise<AiInsightsResult | null> => {
  if (!apiKey) throw new Error('API Key is missing');

  let prompt = '';
  const basePromptEnd = `
Respond ONLY with a valid JSON object matching this TypeScript interface exactly:
{
  "metrics": [ { "title": "string (arabic short)", "value": "string (number or %)", "status": "success" | "warning" | "danger" | "info" } ],
  "insights": [ "string (arabic bullet points)" ]
}
Make the insights actionable and specific to the data. Use Arabic language for all output text. DO NOT wrap JSON in markdown block, return raw JSON string.`;

  if (analysisType === 'absence') {
    prompt = `You are a data analyst for a school exam control system. Analyze the following student absence/delay data and provide a mini-dashboard structure.
Data: ${JSON.stringify(dataContext)} ${basePromptEnd}`;
  } else if (analysisType === 'proctor') {
    prompt = `You are a data analyst for a school exam control system. Analyze the following proctor delay and alert data and provide a mini-dashboard structure.
Data: ${JSON.stringify(dataContext)} ${basePromptEnd}`;
  } else if (analysisType === 'receipt') {
     prompt = `You are a data analyst for a school exam control system. Analyze the following envelope receipt and delivery logs and provide a mini-dashboard structure.
Data: ${JSON.stringify(dataContext)} ${basePromptEnd}`;
  } else if (analysisType === 'errors') {
     prompt = `You are an expert system auditor for a school exam control system. Analyze the following daily system errors, unresolved alerts, and system issues, and provide a mini-dashboard structure.
Data: ${JSON.stringify(dataContext)} ${basePromptEnd}`;
  } else if (analysisType === 'predictive') {
     prompt = `You are an advanced predictive AI for a school exam control system. Your job is to look at the historical data patterns (teacher delays, missing papers, specific committee issues, absence trends) and PREDICT what might go wrong TOMORROW. Provide proactive warnings and suggestions to prevent them. 
Data: ${JSON.stringify(dataContext)} ${basePromptEnd}`;
  } else if (analysisType === 'auditor') {
     prompt = `You are an AI fairness auditor for a school exam control system. Review the 'supervisions' schedule and teacher assignment data.
CRITICAL RULES:
1. The 'supervisions' data spans MULTIPLE DAYS (date field). Do NOT sum all assignments across all days and call it a burden. It is normal for a teacher to have 1 assignment per day for 15 days (total 15).
2. A burden is ONLY when a teacher has multiple assignments ON THE SAME DAY (e.g. period 1 and period 2), OR if they are assigned to work many more DAYS than other teachers.
3. Identify teachers with 0 assignments overall, and suggest assigning them to relieve teachers who work every single day.
4. Propose balancing swaps (e.g., swapping Teacher A with Teacher B on a specific date).
Data: ${JSON.stringify(dataContext)} ${basePromptEnd}`;
  }

  for (const model of AI_MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Smart Exam Control System'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices[0].message.content;
      
      // Clean up potential markdown formatting from LLM
      content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(content);
      
      if (parsed.metrics && parsed.insights) {
          return parsed as AiInsightsResult;
      }
      throw new Error('Invalid JSON structure returned by AI');
      
    } catch (error) {
      console.warn(`Model ${model} failed, trying next... Error:`, error);
      // Continue to next
    }
  }
  
  throw new Error('جميع النماذج الذكية تحت الضغط حالياً، يرجى المحاولة لاحقاً.');
};

export const fetchAIChat = async (
  apiKey: string,
  dataContext: any,
  userMessage: string
): Promise<string> => {
  if (!apiKey) throw new Error('API Key is missing');

  const prompt = `أنت مساعد ذكي متخصص في تحليل بيانات كنترول الاختبارات المدرسية.
البيانات الحالية للسبعة أيام الماضية:
${JSON.stringify(dataContext)}

سؤال المستخدم: ${userMessage}

أجب باللغة العربية بدقة، بشكل احترافي، وكن مختصراً ومباشراً بناءً على البيانات المتوفرة فقط. إذا طلب أرقاماً، أعطه الأرقام بدقة. استخدم التنسيق (Markdown) في إجابتك لتكون واضحة.`;

  for (const model of AI_MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Smart Exam Control System'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
      
    } catch (error) {
      console.warn(`Model ${model} failed, trying next... Error:`, error);
    }
  }
  
  throw new Error('جميع النماذج الذكية تحت الضغط حالياً، يرجى المحاولة لاحقاً.');
};
