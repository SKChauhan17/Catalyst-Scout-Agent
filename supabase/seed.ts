import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import OpenAI from 'openai';

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ONLY use Service Role in backend scripts
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenRouter
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const CANDIDATE_COUNT = 100;
const BATCH_SIZE = 5;

async function generateCandidates() {
  console.log('Loading local embedding model (Xenova/gte-small)...');
  const extractor = await pipeline('feature-extraction', 'Xenova/gte-small');

  const candidatesToInsert = [];
  console.log(`Generating ${CANDIDATE_COUNT} mock candidates...`);

  for (let i = 0; i < CANDIDATE_COUNT; i += BATCH_SIZE) {
    try {
      console.log(`Generating batch ${i / BATCH_SIZE + 1}...`);
      const completion = await openai.chat.completions.create({
        model: 'google/gemma-2-9b-it:free',
        messages: [
          {
            role: 'system',
            content: `You are an IT recruitment data generator. Output ONLY a valid JSON array containing exactly ${BATCH_SIZE} objects. No markdown framing or explanations.`,
          },
          {
            role: 'user',
            content: `Generate ${BATCH_SIZE} software engineering candidate JSON objects. Keys required for each object:
            "name" (string), "skills" (array of strings), "location" (string), "salary_expectation" (string), "system_prompt_persona" (a detailed paragraph describing their technical background, personality quirks, and communication style for an AI chat simulation).`,
          },
        ],
      });

      const rawJson = completion.choices[0].message.content || '[]';
      // Clean potential markdown blocks just in case
      const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      const generatedCandidates = JSON.parse(cleanJson);

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
      console.error('Failed to generate/parse batch, continuing...', e);
    }
  }

  console.log(`Bulk inserting ${candidatesToInsert.length} candidates into Supabase...`);
  const { error } = await supabase.from('candidates').insert(candidatesToInsert);
  
  if (error) {
    console.error('Error inserting candidates:', error);
  } else {
    console.log('Successfully seeded candidate database!');
  }
}

generateCandidates().catch(console.error);
