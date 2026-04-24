import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import OpenAI from 'openai';

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ONLY use Service Role in backend scripts
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize SambaNova Cloud (via OpenAI SDK)
const openai = new OpenAI({
  baseURL: 'https://api.sambanova.ai/v1',
  apiKey: process.env.SAMBANOVA_API_KEY,
});

const CANDIDATE_COUNT = 100;
const BATCH_SIZE = 5;
const MAX_RETRIES = 3;

async function generateBatchWithRetry(
  prompt: string, 
  retries = 0
): Promise<any[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'Meta-Llama-3.3-70B-Instruct',
      messages: [
        {
          role: 'system',
          content: `You are an IT recruitment data generator. Output ONLY a valid JSON array containing exactly ${BATCH_SIZE} objects. No markdown framing or explanations.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const rawJson = completion.choices[0].message.content || '[]';
    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    if (retries < MAX_RETRIES) {
      const waitTime = Math.pow(2, retries) * 1000;
      console.warn(`SambaNova API error. Retrying in ${waitTime}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
      await new Promise(res => setTimeout(res, waitTime));
      return generateBatchWithRetry(prompt, retries + 1);
    }
    
    throw new Error(`Failed to generate batch after ${MAX_RETRIES} retries: ${error}`);
  }
}

async function generateCandidates() {
  console.log('Loading local embedding model (Supabase/gte-small)...');
  const extractor = await pipeline('feature-extraction', 'Supabase/gte-small');

  const candidatesToInsert = [];
  console.log(`Generating ${CANDIDATE_COUNT} mock candidates...`);

  for (let i = 0; i < CANDIDATE_COUNT; i += BATCH_SIZE) {
    console.log(`Generating batch ${i / BATCH_SIZE + 1} of ${CANDIDATE_COUNT / BATCH_SIZE}...`);
    
    const prompt = `Generate ${BATCH_SIZE} software engineering candidate JSON objects. Keys required for each object:
    "name" (string), "skills" (array of strings), "location" (string), "salary_expectation" (string), "system_prompt_persona" (a detailed paragraph describing their technical background, personality quirks, and communication style for an AI chat simulation).`;

    try {
      const generatedCandidates = await generateBatchWithRetry(prompt);

      for (const candidate of generatedCandidates) {
        // Embed the candidate's skills + persona
        const textToEmbed = `Skills: ${candidate.skills.join(', ')}. Persona: ${candidate.system_prompt_persona}`;
        const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        candidatesToInsert.push({
          name: candidate.name,
          skills: candidate.skills,
          location: candidate.location,
          salary_expectation: candidate.salary_expectation,
          system_prompt_persona: candidate.system_prompt_persona,
          embedding: embedding,
        });
      }
    } catch (e) {
      console.error('Critical failure on batch, skipping...', e);
    }
  }

  console.log(`Bulk inserting ${candidatesToInsert.length} candidates into Supabase...`);
  if (candidatesToInsert.length === 0) {
    console.warn('No candidates generated. Exiting.');
    return;
  }
  
  const { error } = await supabase.from('candidates').insert(candidatesToInsert);
  
  if (error) {
    console.error('Error inserting candidates:', error);
  } else {
    console.log('Successfully seeded candidate database!');
  }
}

generateCandidates().catch(console.error);
