'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Award, BookOpenCheck, Check, CheckCircle2, Clock3, FileText, Loader2, MessageSquareWarning, RefreshCw, Save, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { PerformanceBreakdown } from '@/components/quiz/PerformanceBreakdown';
import type { PublicQuestion, QuestionEvaluation } from '@/types/quiz';

interface Simulado {
  id: string;
  titulo: string;
  totalQuestoes: number;
  temasFoco: string | null;
  pdfNome: string;
  questoesJson: PublicQuestion[];
  createdAt: string;
}

export default function SimuladoClient({ simulado, forceRetake = false }: { simulado: Simulado; forceRetake?: boolean }) {
  const questions = simulado.questoesJson;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [confirmedAnswers, setConfirmedAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Record<number, QuestionEvaluation>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [reporting, setReporting] = useState(false);
  const startedAt = useRef(Date.now());

  const question = questions[currentIndex];
  const confirmed = confirmedAnswers[question?.id] !== undefined;
  const score = useMemo(() => Object.values(evaluations).filter((evaluation) => evaluation.correct === true).length, [evaluations]);
  const objectiveCount = useMemo(() => questions.filter((item) => item.tipo !== 'discursiva').length, [questions]);
  const progress = ((currentIndex + 1) / questions.length) * 100;

  useEffect(() => {
    if (forceRetake) {
      setLoading(false);
      return;
    }
    fetch(`/api/tentativa?simuladoId=${simulado.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao recuperar progresso');
        return data;
      })
      .then((data) => {
        if (data.progress) {
          const restoredElapsed = data.progress.elapsedSeconds || 0;
          setElapsedSeconds(restoredElapsed);
          startedAt.current = Date.now() - restoredElapsed * 1000;
          setCurrentIndex(Math.min(data.progress.currentIndex || 0, questions.length - 1));
          setSelectedAnswers(data.progress.selectedAnswers || {});
          setConfirmedAnswers(data.progress.respostas || {});
          setEvaluations(data.progress.evaluations || {});
          if (data.progress.completed) {
            setDurationSeconds(data.progress.result?.durationSeconds || 0);
            setFinished(true);
          }
        }
      })
      .catch(() => toast.error('Não foi possível recuperar seu progresso.'))
      .finally(() => setLoading(false));
  }, [forceRetake, questions.length, simulado.id]);

  useEffect(() => {
    if (loading || finished) return;
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [finished, loading]);

  const saveProgress = useCallback(async () => {
    if (loading || finished) return;
    setSaving(true);
    try {
      const response = await fetch('/api/tentativa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simuladoId: simulado.id, respostas: confirmedAnswers, selectedAnswers, currentIndex, elapsedSeconds: Math.floor((Date.now() - startedAt.current) / 1000), totalQuestoes: questions.length, isFinal: false }),
      });
      if (!response.ok) throw new Error('Falha ao salvar progresso');
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [confirmedAnswers, currentIndex, finished, loading, questions.length, selectedAnswers, simulado.id]);

  useEffect(() => {
    if (loading || finished) return;
    const timer = setTimeout(saveProgress, 1200);
    return () => clearTimeout(timer);
  }, [finished, loading, saveProgress]);

  const confirmAnswer = async () => {
    const answer = selectedAnswers[question.id];
    if (!answer) return;
    setSaving(true);
    try {
      const response = await fetch('/api/resposta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simuladoId: simulado.id, questionId: question.id, answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao corrigir resposta');
      setConfirmedAnswers((current) => ({ ...current, [question.id]: answer }));
      setEvaluations((current) => ({ ...current, [question.id]: data.evaluation }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível corrigir a resposta.');
    } finally {
      setSaving(false);
    }
  };

  const finishQuiz = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/tentativa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simuladoId: simulado.id,
          respostas: confirmedAnswers,
          selectedAnswers,
          elapsedSeconds,
          totalQuestoes: questions.length,
          isFinal: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao finalizar');
      setDurationSeconds(data.durationSeconds || elapsedSeconds);
      setFinished(true);
      toast.success('Simulado concluído!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o resultado.');
    } finally {
      setSaving(false);
    }
  };

  const reportQuestion = async () => {
    if (reportMessage.trim().length < 3) return toast.error('Descreva o problema com a questão.');
    setReporting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simuladoId: simulado.id, questaoId: question.id, type: 'other', message: reportMessage.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao enviar feedback');
      setReportOpen(false);
      setReportMessage('');
      toast.success('Feedback enviado. Obrigado!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o feedback.');
    } finally {
      setReporting(false);
    }
  };

  if (loading) return <DashboardShell focusMode><div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="w-9 h-9 animate-spin text-blue-700" /></div></DashboardShell>;
  if (!question) return <DashboardShell focusMode><div className="p-10 text-center">Este simulado não possui questões válidas.</div></DashboardShell>;

  if (finished) {
    const percentage = objectiveCount ? Math.round((score / objectiveCount) * 100) : 0;
    const incorrect = objectiveCount - score;
    const minutes = Math.max(1, Math.round((durationSeconds || elapsedSeconds) / 60));
    const fallbackTheme = simulado.temasFoco?.split(',')[0]?.trim() || simulado.titulo;
    const performanceMessage = percentage >= 85 ? 'Excelente desempenho!' : percentage >= 70 ? 'Muito bom! Continue avançando.' : percentage >= 50 ? 'Bom começo. Revise os pontos de atenção.' : 'Continue revisando o material e tente novamente.';
    return (
      <DashboardShell>
        <div className="max-w-5xl mx-auto p-5 sm:p-8 pb-28">
          <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm text-center relative overflow-hidden">
            <Award className="w-16 h-16 text-[#b77900] mx-auto" /><h1 className="text-3xl sm:text-4xl font-black mt-3">Simulado concluído!</h1><p className="text-slate-600 mt-2">{performanceMessage} Você finalizou {simulado.titulo}.</p>
            <div className="grid md:grid-cols-[300px_1fr] gap-6 mt-9 text-left">
              <div className="rounded-3xl bg-slate-50 flex flex-col items-center justify-center p-7"><div className="w-48 h-48 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#08b76c ${percentage * 3.6}deg, #e5eaf2 0deg)` }}><div className="w-36 h-36 bg-white rounded-full flex flex-col items-center justify-center"><span className="text-5xl font-black">{percentage}%</span><span className="text-xs text-slate-500 font-bold uppercase">de acertos</span></div></div><p className="font-black text-2xl mt-5">{score} de {objectiveCount}</p><p className="text-sm text-slate-500">questões objetivas</p></div>
              <div className="grid sm:grid-cols-2 gap-4">{[
                [CheckCircle2,score,'Questões corretas','bg-emerald-50 text-emerald-600'],
                [XCircle,incorrect,'Questões incorretas','bg-red-50 text-red-500'],
                [FileText,Object.keys(confirmedAnswers).length,'Questões respondidas','bg-amber-50 text-amber-700'],
                [Clock3,`${minutes} min`,'Tempo de resolução','bg-blue-50 text-blue-700'],
              ].map(([Icon,value,label,color]) => { const I = Icon as typeof CheckCircle2; return <div key={String(label)} className="border border-slate-200 rounded-2xl p-5 flex items-center gap-4"><span className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}><I className="w-6 h-6" /></span><div><p className="text-2xl font-black">{String(value)}</p><p className="text-sm text-slate-500">{String(label)}</p></div></div>})}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-7"><button onClick={() => setReviewing((value) => !value)} className="px-6 py-3 rounded-xl avanco-navy text-white font-bold">{reviewing ? 'Ocultar revisão' : 'Revisar questões'}</button><Link href={`/dashboard/simulado/${simulado.id}?retake=1`} className="px-6 py-3 rounded-xl border border-slate-300 font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refazer simulado</Link><Link href="/dashboard" className="px-6 py-3 rounded-xl border border-slate-300 font-bold">Voltar ao dashboard</Link></div>
          </section>
          <PerformanceBreakdown questions={questions} evaluations={evaluations} fallbackTheme={fallbackTheme} />
          {reviewing && <section className="mt-6 space-y-4">{questions.map((item) => { const answer = selectedAnswers[item.id]; const evaluation = evaluations[item.id]; const correct = evaluation?.correct === true; return <article key={item.id} className="bg-white border border-slate-200 rounded-2xl p-6"><div className="flex items-start gap-3"><span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${item.tipo === 'discursiva' ? 'bg-amber-100 text-amber-700' : correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.tipo === 'discursiva' ? <FileText className="w-4 h-4" /> : correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}</span><div className="min-w-0 flex-1"><h3 className="font-black">Questão {item.id}</h3><p className="mt-2">{item.enunciado}</p><p className="text-sm mt-4"><strong>Sua resposta:</strong> {answer || 'Não respondida'}</p><p className="text-sm mt-1 text-emerald-700"><strong>Resposta esperada:</strong> {evaluation?.correctAnswer || 'Disponível após responder'}</p><p className="text-sm text-slate-600 mt-3 bg-slate-50 p-3 rounded-xl"><strong>Justificativa:</strong> {evaluation?.justification || 'Disponível após responder'}</p><SourceEvidence sources={evaluation?.sources} /></div></div></article>})}</section>}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell focusMode>
      <div className="mx-auto max-w-[1380px] px-4 py-5 sm:px-7 sm:py-7 lg:px-10 pb-16">
        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_18px_55px_rgba(15,45,95,0.08)]">
          <div className="flex flex-col gap-5 border-b border-slate-100 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-blue-700"><ArrowLeft className="h-4 w-4" /> Sair do simulado</Link>
              <h1 className="mt-2 truncate text-xl font-black sm:text-2xl">{simulado.titulo}</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${saveFailed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saveFailed ? 'Falha ao salvar' : saving ? 'Salvando...' : 'Progresso salvo'}</span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-[#071d49] px-3 py-2 text-sm font-black text-white"><Clock3 className="h-4 w-4 text-[#ffc400]" />{formatElapsedTime(elapsedSeconds)}</span>
            </div>
          </div>
          <div className="px-5 py-4 sm:px-7">
            <div className="flex items-center justify-between gap-4 text-sm"><p className="font-black">Questão {currentIndex + 1} <span className="font-medium text-slate-500">de {questions.length}</span></p><span className="font-black text-blue-700">{Math.round(progress)}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[224px_minmax(0,1fr)]">
          <aside className="hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:block lg:sticky lg:top-24">
            <div className="flex items-center justify-between"><div><h2 className="font-black">Mapa da prova</h2><p className="mt-1 text-xs text-slate-500">{Object.keys(confirmedAnswers).length} respondidas</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-black text-blue-700">{questions.length}</span></div>
            <QuestionNavigator questions={questions} currentIndex={currentIndex} confirmedAnswers={confirmedAnswers} onSelect={setCurrentIndex} vertical />
            <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-700" /> Questão atual</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Respondida</span></div>
          </aside>
          <main className="min-w-0">
            <div className="overflow-x-auto pb-2 lg:hidden"><QuestionNavigator questions={questions} currentIndex={currentIndex} confirmedAnswers={confirmedAnswers} onSelect={setCurrentIndex} /></div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,45,95,0.07)] sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black capitalize text-blue-700">{question.tipo.replaceAll('_', ' ')}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">{question.dificuldade}</span></div><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Questão {question.id}</span></div>
          <h2 className="mt-5 max-w-4xl text-xl font-black leading-snug sm:text-2xl lg:text-[1.7rem]">{question.enunciado}</h2>
          {question.tipo === 'discursiva' ? <textarea value={selectedAnswers[question.id] || ''} onChange={(event) => setSelectedAnswers((current) => ({ ...current, [question.id]: event.target.value }))} disabled={confirmed} rows={7} placeholder="Escreva sua resposta..." className="w-full mt-6 border border-slate-300 rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none disabled:bg-slate-50" /> : <div className="space-y-3 mt-7">{question.opcoes.map((option) => { const selected = selectedAnswers[question.id] === option; const correctOption = confirmed && option === evaluations[question.id]?.correctAnswer; const wrong = confirmed && selected && !correctOption; return <button key={option} onClick={() => !confirmed && setSelectedAnswers((current) => ({ ...current, [question.id]: option }))} disabled={confirmed} className={`w-full rounded-xl border-2 p-4 text-left font-medium transition-all flex items-center gap-4 ${correctOption ? 'border-emerald-500 bg-emerald-50' : wrong ? 'border-red-400 bg-red-50' : selected ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 hover:border-blue-300'}`}><span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{option.charAt(0)}</span>{option.replace(/^[A-D]\)\s*/, '')}</button>})}</div>}

          {confirmed && <><div className={`mt-7 rounded-2xl border p-5 ${question.tipo === 'discursiva' ? 'bg-blue-50 border-blue-200' : evaluations[question.id]?.correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}><h3 className="font-black text-lg">{question.tipo === 'discursiva' ? 'Compare sua resposta' : evaluations[question.id]?.correct ? 'Correto!' : 'Resposta incorreta'}</h3><p className="mt-3 text-sm"><strong>Resposta esperada:</strong> {evaluations[question.id]?.correctAnswer}</p><p className="mt-3 text-sm leading-relaxed"><strong>Justificativa:</strong> {evaluations[question.id]?.justification}</p><SourceEvidence sources={evaluations[question.id]?.sources} /></div><div className="mt-4"><button type="button" onClick={() => setReportOpen((open) => !open)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-blue-700"><MessageSquareWarning className="w-4 h-4" /> Reportar problema nesta questão</button>{reportOpen && <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><label htmlFor="question-report" className="text-sm font-bold">O que precisa ser corrigido?</label><textarea id="question-report" value={reportMessage} onChange={(event) => setReportMessage(event.target.value.slice(0, 1000))} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:ring-2 focus:ring-blue-600" placeholder="Ex.: a resposta não está no documento ou a justificativa ficou confusa." /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setReportOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-700">Cancelar</button><button type="button" onClick={reportQuestion} disabled={reporting || reportMessage.trim().length < 3} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{reporting ? 'Enviando...' : 'Enviar feedback'}</button></div></div>}</div></>}

          <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row"><button onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-bold transition-colors hover:bg-slate-50 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Anterior</button>{!confirmed ? <button onClick={confirmAnswer} disabled={!selectedAnswers[question.id]} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-7 py-3 font-black text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40">Confirmar resposta <ArrowRight className="h-4 w-4" /></button> : currentIndex < questions.length - 1 ? <button onClick={() => setCurrentIndex((index) => index + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-7 py-3 font-black text-white shadow-lg shadow-blue-700/20">Próxima questão <ArrowRight className="h-4 w-4" /></button> : <button onClick={finishQuiz} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-7 py-3 font-black text-[#06183d] shadow-lg shadow-amber-300/30">Finalizar simulado <Award className="h-5 w-5" /></button>}</div>
        </section>
          </main>
        </div>
      </div>
    </DashboardShell>
  );
}

function formatElapsedTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function SourceEvidence({ sources }: { sources?: QuestionEvaluation['sources'] }) {
  if (!sources?.length) return null;
  const pages = Array.from(new Set(sources.map((source) => source.pageNumber))).sort((a, b) => a - b);
  const strongest = [...sources].sort((a, b) => b.similarity - a.similarity)[0];
  return <details className="mt-4 rounded-xl border border-blue-200 bg-white/70 p-4"><summary className="cursor-pointer list-none font-bold text-sm text-blue-900 flex items-center gap-2"><BookOpenCheck className="w-4 h-4" /> Comprovação • {strongest.documentName ? `${strongest.documentName} · ` : ''}{pages.length === 1 ? 'página' : 'páginas'} {pages.join(', ')}</summary><div className="mt-3 text-sm text-slate-700"><p className="leading-relaxed">“{strongest.excerpt}”</p><p className="mt-2 text-xs text-slate-500">Chunk {strongest.chunkId} • similaridade {(strongest.similarity * 100).toFixed(1)}%</p></div></details>;
}

function QuestionNavigator({ questions, currentIndex, confirmedAnswers, onSelect, vertical = false }: { questions: PublicQuestion[]; currentIndex: number; confirmedAnswers: Record<number, string>; onSelect: (index: number) => void; vertical?: boolean }) {
  const answeredCount = Object.keys(confirmedAnswers).length;
  return <nav className={vertical ? 'mt-5 grid grid-cols-5 gap-2' : 'flex min-w-max gap-2'} aria-label="Navegação das questões">{questions.map((item, index) => { const answered = confirmedAnswers[item.id] !== undefined; const accessible = index <= answeredCount; return <button key={item.id} type="button" disabled={!accessible} onClick={() => onSelect(index)} aria-current={index === currentIndex ? 'step' : undefined} aria-label={`Ir para questão ${item.id}${answered ? ', respondida' : ''}`} className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-600 transition-all hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 data-[current=true]:scale-105 data-[current=true]:border-blue-700 data-[current=true]:bg-blue-700 data-[current=true]:text-white" data-current={index === currentIndex}>{item.id}{answered && index !== currentIndex && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white"><Check className="h-2.5 w-2.5" /></span>}</button>})}</nav>;
}
