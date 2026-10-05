import { describe, expect, it, vi } from 'vitest';
import { readGenerationStream } from '@/lib/client/generation-stream';

function streamResponse(lines: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      lines.forEach((line) => controller.enqueue(encoder.encode(line)));
      controller.close();
    },
  }));
}

describe('generation progress stream', () => {
  it('reports real completed calls and returns the quiz id', async () => {
    const onProgress = vi.fn();
    const response = streamResponse([
      '{"type":"progress","phase":"generating","completed":4,"total":30,"failed":0,"attempt":1,"message":"4 de 30"}\n',
      '{"type":"progress","phase":"generating","completed":8,"total":30,"failed":0,"attempt":1,"message":"8 de 30"}\n',
      '{"type":"complete","success":true,"quizId":"quiz-123"}\n',
    ]);
    await expect(readGenerationStream(response, onProgress)).resolves.toEqual({ quizId: 'quiz-123' });
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ completed: 8, total: 30 }));
  });

  it('surfaces a streamed server error', async () => {
    const response = streamResponse([
      '{"type":"error","message":"Falha controlada"}\n',
    ]);
    await expect(readGenerationStream(response, vi.fn())).rejects.toThrow('Falha controlada');
  });
});
