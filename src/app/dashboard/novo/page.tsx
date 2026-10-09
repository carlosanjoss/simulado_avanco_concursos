'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, BrainCircuit, Check, FileText, LibraryBig, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { readGenerationStream, type GenerationProgress } from '@/lib/client/generation-stream';
import { processPdfInBrowser, type PdfProcessingProgress } from '@/lib/client/pdf-batch-processor';

interface StoredMaterial { id: string; fileName: string; fileSize: number; totalPages: number; ocrPages: number }

export default function NovoSimuladoPage() {
  const router = useRouter();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [focusTopics, setFocusTopics] = useState('');
  const [questionCount, setQuestionCount] = useState(30);
  const [difficulty, setDifficulty] = useState<'Fácil' | 'Médio' | 'Avançado' | 'Misto'>('Misto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [batchProcessingAvailable, setBatchProcessingAvailable] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfProcessingProgress | null>(null);
  const [materials, setMaterials] = useState<StoredMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/usage').then((response) => response.json()),
      fetch('/api/providers').then((response) => response.json()),
      fetch('/api/materials').then((response) => response.json()),
    ]).then(([usage, providerData, materialData]) => {
      if (usage.success) {
        setRemaining(usage.remaining);
        setUnlimited(Boolean(usage.unlimited));
      }
      setAiAvailable(Boolean(providerData.providers?.some((provider: { available: boolean }) => provider.available)));
      setBatchProcessingAvailable(Boolean(providerData.pdfBatchProcessing));
      const available = (materialData.materials || []) as StoredMaterial[];
      setMaterials(available);
      const requestedMaterial = new URLSearchParams(window.location.search).get('material');
      if (requestedMaterial && available.some((item) => item.id === requestedMaterial)) setSelectedMaterialId(requestedMaterial);
    }).catch(() => setAiAvailable(false));
  }, []);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    if (rejectedFiles.length > 0 || !acceptedFiles[0]) {
      toast.error('Envie um arquivo PDF válido de até 20 MB.');
      return;
    }
    setPdfFile(acceptedFiles[0]);
    setSelectedMaterialId('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
  });

  const generateQuiz = async () => {
    const selectedMaterial = materials.find((item) => item.id === selectedMaterialId);
    if (!pdfFile && !selectedMaterial) return toast.error('Selecione um material ou envie um PDF antes de continuar.');
    if (remaining === 0) return toast.error('Você atingiu seu limite de gerações deste mês.');

    setIsGenerating(true);
    setGenerationProgress(null);
    setPdfProgress(null);
    try {
      const formData = new FormData();
      if (selectedMaterial) {
        formData.append('documentId', selectedMaterial.id);
        formData.append('ocrUsed', String(selectedMaterial.ocrPages > 0));
      } else if (batchProcessingAvailable && pdfFile) {
        const processed = await processPdfInBrowser(pdfFile, setPdfProgress);
        formData.append('documentId', processed.documentId);
        formData.append('ocrUsed', String(processed.ocrPages > 0));
        setPdfProgress(null);
      } else if (pdfFile) {
        formData.append('file', pdfFile);
      }
      if (focusTopics.trim()) formData.append('focusTopics', focusTopics.trim());
      formData.append('questionCount', String(questionCount));
      formData.append('difficulty', difficulty);

      setGenerationProgress({
        phase: 'retrieving', completed: 0, total: questionCount, failed: 0, attempt: 1,
        message: `Preparando fontes específicas para ${questionCount} questões...`,
      });
      const response = await fetch('/api/gerador', {
        method: 'POST',
        headers: { Accept: 'application/x-ndjson' },
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Não foi possível iniciar a geração.');
      }
      const data = await readGenerationStream(response, setGenerationProgress);
      toast.success('Simulado criado com sucesso!');
      router.push(`/dashboard/simulado/${data.quizId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar simulado.');
      setIsGenerating(false);
    } finally {
      setPdfProgress(null);
      setGenerationProgress(null);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto p-5 sm:p-8 pb-28">
        <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-700 mb-5"><ArrowLeft className="w-4 h-4" /> Voltar para o dashboard</button>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div><p className="text-blue-700 font-bold uppercase tracking-widest text-xs">Novo simulado</p><h1 className="text-3xl sm:text-4xl font-black mt-2">Criar Novo Simulado</h1><p className="text-slate-500 mt-1">Envie seu material em PDF e informe os tópicos que deseja focar.</p></div>
          <div className="flex gap-2"><span className={`px-3 py-2 rounded-xl text-xs font-bold ${aiAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{aiAvailable === null ? 'Verificando IA...' : aiAvailable ? 'OpenRouter disponível' : 'OpenRouter não configurada'}</span><span className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">{unlimited ? 'Gerações ilimitadas' : `${remaining ?? '—'} gerações neste mês`}</span></div>
        </div>

        <div className="mt-7 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <Step number={1} title="Escolher material" description="Reutilize um PDF da biblioteca ou envie um novo arquivo de até 20 MB.">
            {materials.length > 0 && <div className="mb-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-700">Da sua biblioteca</p><a href="/dashboard/materiais" className="text-xs font-black text-blue-700">Gerenciar materiais</a></div><div className="grid gap-3 sm:grid-cols-2">{materials.slice(0, 6).map((material) => <button key={material.id} type="button" onClick={() => { setSelectedMaterialId(material.id); setPdfFile(null); }} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${selectedMaterialId === material.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><LibraryBig className="h-5 w-5" /></span><span className="min-w-0"><strong className="block truncate text-sm">{material.fileName}</strong><span className="text-xs text-slate-500">{material.totalPages} páginas</span></span>{selectedMaterialId === material.id && <Check className="ml-auto h-5 w-5 shrink-0 text-blue-700" />}</button>)}</div><div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />ou envie um novo<span className="h-px flex-1 bg-slate-200" /></div></div>}
            <div {...getRootProps()} className={`dropzone cursor-pointer ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} aria-label="Selecionar arquivo PDF" />
              {pdfFile ? <div className="flex items-center gap-4 text-left"><span className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center"><FileText className="w-7 h-7" /></span><div className="flex-1 min-w-0"><p className="font-black truncate">{pdfFile.name}</p><p className="text-sm text-slate-600">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB • PDF pronto para processar</p></div><button type="button" onClick={(event) => { event.stopPropagation(); setPdfFile(null); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-600 hover:text-red-600" aria-label="Remover arquivo"><X className="w-5 h-5" /></button></div> : <div><UploadCloud className="w-12 h-12 text-blue-600 mx-auto" /><p className="font-black text-lg mt-3">Arraste e solte seu PDF aqui</p><p className="text-sm text-slate-600 mt-1">ou clique para selecionar</p><p className="text-xs text-slate-600 mt-4">Apenas PDF • tamanho máximo de 20 MB</p></div>}
            </div>
          </Step>

          <Step number={2} title="Tópicos de foco (opcional)" description="Informe os assuntos que você quer que o simulado priorize.">
            <label className="sr-only" htmlFor="focusTopics">Tópicos de foco</label>
            <textarea id="focusTopics" value={focusTopics} onChange={(event) => setFocusTopics(event.target.value.slice(0, 500))} rows={3} placeholder="Ex.: Princípios fundamentais, direitos e garantias, controle de constitucionalidade..." className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
            <div className="flex justify-between mt-2 text-xs text-slate-600"><span>Separe os temas por vírgulas</span><span>{focusTopics.length}/500</span></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Quantidade de questões<select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium"><option value={10}>10 questões</option><option value={20}>20 questões</option><option value={30}>30 questões</option><option value={40}>40 questões</option><option value={50}>50 questões</option></select></label>
              <label className="text-sm font-bold text-slate-700">Dificuldade<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium"><option>Fácil</option><option>Médio</option><option>Avançado</option><option>Misto</option></select></label>
            </div>
          </Step>

          <Step number={3} title="Confirmar e gerar" description="Seu simulado será criado com estas características.">
            <div className="grid sm:grid-cols-2 gap-3 bg-slate-50 rounded-2xl p-5">{[`${questionCount} questões`,'Somente múltipla escolha','4 alternativas por questão',`Dificuldade: ${difficulty}`,selectedMaterialId ? 'Material reutilizado da biblioteca' : 'Novo PDF salvo na biblioteca','OCR automático para páginas digitalizadas'].map((item) => <div key={item} className="flex items-center gap-2 text-sm font-semibold"><span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></span>{item}</div>)}</div>
          </Step>

          <div className="p-6 bg-slate-50 border-t border-slate-200">
            {isGenerating ? <div className="rounded-2xl avanco-navy text-white p-6"><div className="flex items-center gap-4"><span className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center"><BrainCircuit className="w-6 h-6 text-[#ffc400] animate-pulse" /></span><div className="flex-1"><p className="font-black">{pdfProgress?.message || generationProgress?.message || 'Iniciando processamento...'}</p><div className="h-2 bg-white/10 rounded-full mt-3 overflow-hidden"><div className="h-full bg-[#ffc400] transition-all duration-500" style={{ width: `${pdfProgress?.totalPages ? (pdfProgress.currentPage / pdfProgress.totalPages) * 100 : generationProgress ? (generationProgress.completed / generationProgress.total) * 100 : 0}%` }} /></div>{pdfProgress?.totalPages ? <p className="mt-2 text-xs text-blue-100">{pdfProgress.currentPage} de {pdfProgress.totalPages} páginas • lote {pdfProgress.currentBatch} de {pdfProgress.totalBatches}</p> : generationProgress ? <p className="mt-2 text-xs text-blue-100">{generationProgress.completed} de {generationProgress.total} questões concluídas{generationProgress.attempt > 1 ? ` • tentativa ${generationProgress.attempt}` : ''}{generationProgress.failed > 0 ? ` • ${generationProgress.failed} aguardando nova tentativa` : ''}</p> : null}</div><Loader2 className="w-6 h-6 animate-spin" /></div><p className="text-xs text-blue-100 mt-4">Progresso informado diretamente pelo servidor. Não feche esta página durante o processamento.</p></div> : <><button onClick={generateQuiz} disabled={(!pdfFile && !selectedMaterialId) || remaining === 0 || aiAvailable !== true} className="w-full bg-[#ffc400] text-[#06183d] rounded-xl py-4 font-black text-lg flex items-center justify-center gap-3 hover:bg-yellow-300 disabled:opacity-60 disabled:cursor-not-allowed"><Sparkles className="w-5 h-5" /> Gerar Simulado</button>{aiAvailable === false && <p className="text-sm text-amber-900 text-center mt-3">Configure a chave da OpenRouter para habilitar a geração.</p>}{batchProcessingAvailable && <p className="text-xs text-emerald-800 text-center mt-3">PDFs processados ficam na biblioteca e podem ser reutilizados sem novo envio.</p>}</>}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function Step({ number, title, description, children }: { number: number; title: string; description: string; children: React.ReactNode }) {
  return <section className="p-6 sm:p-8 border-b border-slate-100"><div className="flex gap-4"><span className="shrink-0 w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">{number}</span><div className="flex-1 min-w-0"><h2 className="font-black text-lg">{title}</h2><p className="text-sm text-slate-600 mt-0.5 mb-5">{description}</p>{children}</div></div></section>;
}
