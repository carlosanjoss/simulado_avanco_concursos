import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { env as transformersEnv, pipeline } from '@huggingface/transformers';

const source = await readFile('.env.local', 'utf8');
const getValue = (name) => [...source.matchAll(new RegExp(`^${name}=(.*)$`, 'gm'))]
  .at(-1)?.[1].trim().replace(/^["']|["']$/g, '');
const supabase = createClient(
  getValue('SUPABASE_URL') || getValue('NEXT_PUBLIC_SUPABASE_URL'),
  getValue('SUPABASE_SECRET_KEY') || getValue('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const latest = await supabase.from('simulado_documents').select('*')
  .eq('status', 'ready').order('created_at', { ascending: false }).limit(1).single();
if (latest.error) throw latest.error;

const objectives = [
  'definições, conceitos centrais e terminologia técnica',
  'relações de causa e efeito e consequências práticas',
  'etapas, procedimentos, métodos e ordem de execução',
  'comparações, diferenças, classificações e categorias',
  'regras, requisitos, condições, limites e exceções',
  'aplicações, exemplos, casos concretos e resolução de problemas',
  'dados, fórmulas, cálculos, grandezas e relações quantitativas',
  'argumentos, conclusões e implicações do conteúdo',
];
const plans = Array.from({ length: 30 }, (_, index) => ({
  from: Math.floor((index * latest.data.total_pages) / 30) + 1,
  to: Math.max(1, Math.floor(((index + 1) * latest.data.total_pages) / 30)),
  query: `${objectives[index % objectives.length]}; conteúdo específico e verificável para elaborar uma questão`,
}));

transformersEnv.cacheDir = path.join(process.cwd(), '.cache', 'transformers');
transformersEnv.useFSCache = true;
const embedder = await pipeline('feature-extraction', getValue('EMBEDDING_MODEL') || 'Xenova/all-MiniLM-L6-v2', {
  device: 'cpu', dtype: 'q8',
});
const output = await embedder(plans.map((plan) => plan.query), { pooling: 'mean', normalize: true });
const embeddings = output.tolist();
const results = [];
for (let index = 0; index < plans.length; index += 1) {
  const plan = plans[index];
  const match = await supabase.rpc('match_simulado_chunks', {
    query_embedding: embeddings[index],
    match_threshold: -1,
    match_count: 20,
    p_document_id: latest.data.id,
    p_user_id: latest.data.user_id,
    p_page_from: plan.from,
    p_page_to: plan.to,
  });
  if (match.error) throw match.error;
  results.push({ index: index + 1, ...plan, matches: match.data });
}

const uniqueChunks = new Set(results.flatMap((result) => result.matches.map((match) => String(match.id))));
const uniquePages = new Set(results.flatMap((result) => result.matches.map((match) => match.page_number)));
process.stdout.write(`${JSON.stringify({
  success: results.every((result) => result.matches.length > 0),
  contexts: results.length,
  contextsWithMatches: results.filter((result) => result.matches.length > 0).length,
  uniqueChunks: uniqueChunks.size,
  uniquePages: uniquePages.size,
  coveredFromPage: Math.min(...uniquePages),
  coveredToPage: Math.max(...uniquePages),
}, null, 2)}\n`);
