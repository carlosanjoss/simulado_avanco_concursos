export interface GenerationProgress {
  phase: 'retrieving' | 'generating' | 'deduplicating' | 'saving';
  completed: number;
  total: number;
  failed: number;
  attempt: number;
  message: string;
}

export async function readGenerationStream(
  response: Response,
  onProgress: (progress: GenerationProgress) => void,
): Promise<{ quizId: string }> {
  if (!response.body) throw new Error('O navegador não conseguiu acompanhar a geração em tempo real.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const streamState: { completedPayload?: { quizId: string } } = {};

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ({ type: 'progress' } & GenerationProgress)
      | { type: 'complete'; quizId: string }
      | { type: 'error'; message?: string };
    if (event.type === 'progress') onProgress(event);
    if (event.type === 'complete') streamState.completedPayload = { quizId: event.quizId };
    if (event.type === 'error') throw new Error(event.message || 'Não foi possível gerar o simulado.');
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consumeLine);
    if (done) break;
  }
  consumeLine(buffer);
  if (!streamState.completedPayload) throw new Error('A geração terminou sem devolver o simulado.');
  return streamState.completedPayload;
}
