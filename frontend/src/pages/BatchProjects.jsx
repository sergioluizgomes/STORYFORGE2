import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { buildApiUrl } from '../lib/api';
import {
    Layers, Play, CheckCircle2, XCircle, Clock, Loader2,
    AlertTriangle, ChevronRight, FileText, Copy, RotateCcw
} from 'lucide-react';

// ─── Example JSON template ────────────────────────────────────────────────────

const EXAMPLE_JSON = JSON.stringify(
    [
        {
            name: "Projeto Exemplo 1",
            language: "Português Brasileiro",
            narrativeStyle: "Thriller Psicológico",
            imageStyle: "Cinematográfico",
            premise: "A verdade que resiste ao medo sempre vence.",
            sourceText: "Era uma vez uma cidade esquecida pelo tempo...",
            chapters: [
                { number: 1, type: "NORMAL",      description: "Apresentação do protagonista e do conflito" },
                { number: 2, type: "ACTION",       description: "Primeira crise — ponto sem retorno" },
                { number: 3, type: "REVELATION",   description: "A grande revelação que muda tudo" },
                { number: 4, type: "FINAL",        description: "Clímax e resolução" }
            ]
        },
        {
            name: "Projeto Exemplo 2",
            language: "English",
            narrativeStyle: "Space Opera",
            imageStyle: "Sci-Fi",
            premise: "Only through sacrifice can a civilization survive.",
            sourceText: "The last colony ship drifted in silence among the stars...",
            chapters: [
                { number: 1, type: "NORMAL", description: "The colony's last hope" },
                { number: 2, type: "FINAL",  description: "Final stand" }
            ]
        }
    ],
    null,
    2
);

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    pending:              { label: 'Aguardando',    color: 'text-gray-400',   bg: 'bg-gray-700/50',   Icon: Clock },
    running:              { label: 'Gerando...',    color: 'text-blue-400',   bg: 'bg-blue-900/30',   Icon: Loader2, spin: true },
    completed:            { label: 'Concluído',     color: 'text-green-400',  bg: 'bg-green-900/30',  Icon: CheckCircle2 },
    completed_with_errors:{ label: 'Com erros',     color: 'text-yellow-400', bg: 'bg-yellow-900/30', Icon: AlertTriangle },
    failed:               { label: 'Falhou',        color: 'text-red-400',    bg: 'bg-red-900/30',    Icon: XCircle },
    cancelled:            { label: 'Cancelado',     color: 'text-gray-500',   bg: 'bg-gray-800/50',   Icon: XCircle }
};

const BATCH_STATUS_CONFIG = {
    pending:              { label: 'Aguardando início', color: 'text-gray-400' },
    running:              { label: 'Em andamento',      color: 'text-blue-400' },
    completed:            { label: 'Concluído',         color: 'text-green-400' },
    completed_with_errors:{ label: 'Concluído com erros', color: 'text-yellow-400' },
    failed:               { label: 'Falhou',            color: 'text-red-400' },
    cancelled:            { label: 'Cancelado',         color: 'text-gray-500' }
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const { Icon } = cfg;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
            <Icon size={12} className={cfg.spin ? 'animate-spin' : ''} />
            {cfg.label}
        </span>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BatchProjects() {
    const [jsonInput, setJsonInput]   = useState('');
    const [parseError, setParseError] = useState(null);
    const [batchId, setBatchId]       = useState(null);
    const [job, setJob]               = useState(null);
    const [starting, setStarting]     = useState(false);
    const [startError, setStartError] = useState(null);
    const [copied, setCopied]         = useState(false);
    const pollingRef = useRef(null);

    // ── Parse validation ──
    const parsedItems = (() => {
        if (!jsonInput.trim()) return null;
        try {
            const parsed = JSON.parse(jsonInput);
            if (!Array.isArray(parsed)) return { error: 'O JSON deve ser um array (começar com [)' };
            return { items: parsed };
        } catch (e) {
            return { error: `JSON inválido: ${e.message}` };
        }
    })();

    const inputError = parsedItems?.error || null;
    const itemCount = parsedItems?.items?.length || 0;

    // ── Polling ──
    const fetchJob = useCallback(async (id) => {
        try {
            const { data } = await axios.get(buildApiUrl(`/batch/${id}`));
            setJob(data);
            if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(data.status)) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        } catch (err) {
            console.error('Polling error:', err);
        }
    }, []);

    useEffect(() => {
        if (!batchId) return;
        fetchJob(batchId);
        pollingRef.current = setInterval(() => fetchJob(batchId), 5000);
        return () => clearInterval(pollingRef.current);
    }, [batchId, fetchJob]);

    // ── Actions ──
    const handleLoadExample = () => {
        setJsonInput(EXAMPLE_JSON);
        setParseError(null);
    };

    const handleCopyExample = async () => {
        await navigator.clipboard.writeText(EXAMPLE_JSON);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStart = async () => {
        if (!parsedItems?.items) return;
        setStarting(true);
        setStartError(null);

        try {
            const { data } = await axios.post(buildApiUrl('/batch'), parsedItems.items);
            setBatchId(data.batchId);
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
            setStartError(msg);
        } finally {
            setStarting(false);
        }
    };

    const handleReset = () => {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setBatchId(null);
        setJob(null);
        setStartError(null);
        setJsonInput('');
    };

    // ── Derived stats ──
    const stats = job ? {
        total:     job.items.length,
        pending:   job.items.filter(i => i.status === 'pending').length,
        running:   job.items.filter(i => i.status === 'running').length,
        completed: job.items.filter(i => i.status === 'completed').length,
        failed:    job.items.filter(i => ['failed', 'cancelled'].includes(i.status)).length,
    } : null;

    const batchFinished = job && ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(job.status);
    const batchCfg = job ? (BATCH_STATUS_CONFIG[job.status] || BATCH_STATUS_CONFIG.pending) : null;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Input Phase (no active batch)
    // ─────────────────────────────────────────────────────────────────────────

    if (!batchId) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Layers size={28} className="text-purple-400" />
                        <h1 className="text-3xl font-bold text-white">Lote de Projetos</h1>
                    </div>
                    <p className="text-gray-400 text-sm">
                        Cole um array JSON com os dados de cada projeto. O sistema criará e gerará cada um sequencialmente.
                    </p>
                </div>

                {/* JSON Input Card */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 space-y-4">

                    {/* Toolbar */}
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                            Array JSON de Projetos
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCopyExample}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
                            >
                                <Copy size={12} />
                                {copied ? 'Copiado!' : 'Copiar exemplo'}
                            </button>
                            <button
                                onClick={handleLoadExample}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
                            >
                                <FileText size={12} />
                                Ver exemplo
                            </button>
                        </div>
                    </div>

                    {/* Textarea */}
                    <textarea
                        value={jsonInput}
                        onChange={e => setJsonInput(e.target.value)}
                        placeholder={`[\n  {\n    "name": "Meu Projeto",\n    "language": "Português Brasileiro",\n    "narrativeStyle": "Thriller Psicológico",\n    "premise": "A verdade vence.",\n    "sourceText": "Era uma vez...",\n    "chapters": [\n      { "number": 1, "type": "NORMAL", "description": "Introdução" }\n    ]\n  }\n]`}
                        className={`w-full h-80 bg-gray-900 border rounded-xl p-4 font-mono text-sm text-gray-200 resize-y focus:outline-none focus:ring-2 transition-colors ${
                            inputError
                                ? 'border-red-500 focus:ring-red-500/30'
                                : jsonInput && !inputError
                                    ? 'border-green-600/50 focus:ring-green-500/20'
                                    : 'border-gray-600 focus:ring-blue-500/30'
                        }`}
                        spellCheck={false}
                    />

                    {/* Validation feedback */}
                    {inputError && (
                        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                            <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>{inputError}</span>
                        </div>
                    )}

                    {!inputError && itemCount > 0 && (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 size={14} />
                            <span>{itemCount} projeto{itemCount > 1 ? 's' : ''} válido{itemCount > 1 ? 's' : ''} detectado{itemCount > 1 ? 's' : ''}</span>
                        </div>
                    )}

                    {/* Start error */}
                    {startError && (
                        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>{startError}</span>
                        </div>
                    )}

                    {/* Start button */}
                    <button
                        onClick={handleStart}
                        disabled={!parsedItems?.items || starting || inputError}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white transition-colors"
                    >
                        {starting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Iniciando lote...
                            </>
                        ) : (
                            <>
                                <Play size={18} />
                                Iniciar Geração em Lote{itemCount > 0 ? ` (${itemCount} projeto${itemCount > 1 ? 's' : ''})` : ''}
                            </>
                        )}
                    </button>
                </div>

                {/* Info notes */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-500">
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                        <div className="font-semibold text-gray-400 mb-1">Sequencial</div>
                        Cada projeto é gerado após o anterior terminar. Sem sobrecarga paralela.
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                        <div className="font-semibold text-gray-400 mb-1">Servidor</div>
                        O processo roda no servidor. Você pode fechar o browser que a geração continua.
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                        <div className="font-semibold text-gray-400 mb-1">Máximo</div>
                        Até 50 projetos por lote. Consulte BATCH_FORMAT.md para todos os campos.
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Progress Phase (active batch)
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Layers size={24} className="text-purple-400" />
                        <h1 className="text-2xl font-bold text-white">Progresso do Lote</h1>
                        {batchCfg && (
                            <span className={`text-sm font-semibold ${batchCfg.color}`}>
                                — {batchCfg.label}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 text-xs font-mono">ID: {batchId}</p>
                </div>

                <div className="flex gap-2">
                    {!batchFinished && (
                        <span className="flex items-center gap-1.5 text-xs text-blue-400 animate-pulse">
                            <Loader2 size={12} className="animate-spin" />
                            Atualizando a cada 5s
                        </span>
                    )}
                    {batchFinished && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
                        >
                            <RotateCcw size={12} />
                            Novo lote
                        </button>
                    )}
                </div>
            </div>

            {/* Summary stats */}
            {stats && (
                <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Total',       value: stats.total,     color: 'text-gray-300' },
                        { label: 'Em execução', value: stats.running,   color: 'text-blue-400' },
                        { label: 'Concluídos',  value: stats.completed, color: 'text-green-400' },
                        { label: 'Falhas',      value: stats.failed,    color: 'text-red-400' }
                    ].map(s => (
                        <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Overall progress bar */}
            {stats && stats.total > 0 && (
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                        <span>Progresso geral</span>
                        <span>{stats.completed} / {stats.total}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Item list */}
            {!job ? (
                <div className="flex items-center justify-center h-40 text-gray-500 gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Carregando...
                </div>
            ) : (
                <div className="space-y-3">
                    {job.items.map((item, idx) => {
                        const config = item.config || {};
                        const isRunning = item.status === 'running';
                        const isDone = item.status === 'completed';
                        const hasFailed = ['failed', 'cancelled'].includes(item.status);

                        return (
                            <div
                                key={idx}
                                className={`bg-gray-800 border rounded-xl p-4 transition-all ${
                                    isRunning ? 'border-blue-600/50 shadow-md shadow-blue-900/20' :
                                    isDone    ? 'border-green-700/40' :
                                    hasFailed ? 'border-red-800/40' :
                                               'border-gray-700'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    {/* Left: index + name */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xs text-gray-600 font-mono w-5 text-right flex-shrink-0">
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-white truncate">
                                                {config.name || '(sem nome)'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                                                {config.narrativeStyle && <span>{config.narrativeStyle}</span>}
                                                {config.language && <span>{config.language}</span>}
                                                {Array.isArray(config.chapters) && config.chapters.length > 0 && (
                                                    <span>{config.chapters.length} cap.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: status + link */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <StatusBadge status={item.status} />
                                        {isDone && item.projectId && (
                                            <Link
                                                to={`/project/${item.projectId}`}
                                                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                Ver projeto
                                                <ChevronRight size={12} />
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Error message */}
                                {hasFailed && item.error && (
                                    <div className="mt-2 ml-8 text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-1.5">
                                        {item.error}
                                    </div>
                                )}

                                {/* Timing info */}
                                {(item.startedAt || item.completedAt) && (
                                    <div className="mt-1.5 ml-8 text-[10px] text-gray-600 flex gap-3">
                                        {item.startedAt && (
                                            <span>Início: {new Date(item.startedAt).toLocaleTimeString('pt-BR')}</span>
                                        )}
                                        {item.completedAt && (
                                            <span>Fim: {new Date(item.completedAt).toLocaleTimeString('pt-BR')}</span>
                                        )}
                                        {item.startedAt && item.completedAt && (
                                            <span>
                                                Duração: {Math.round((new Date(item.completedAt) - new Date(item.startedAt)) / 60000)} min
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Completion banner */}
            {batchFinished && (
                <div className={`mt-6 flex items-center justify-between p-4 rounded-xl border ${
                    job.status === 'completed'
                        ? 'bg-green-900/20 border-green-700/40 text-green-300'
                        : job.status === 'completed_with_errors'
                            ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'
                            : 'bg-red-900/20 border-red-700/40 text-red-300'
                }`}>
                    <span className="font-semibold text-sm">
                        {job.status === 'completed' && '✓ Todos os projetos foram gerados com sucesso!'}
                        {job.status === 'completed_with_errors' && '⚠ Lote finalizado com alguns erros.'}
                        {job.status === 'failed' && '✗ O lote falhou. Verifique os erros acima.'}
                        {job.status === 'cancelled' && '— Lote cancelado.'}
                    </span>
                    <Link
                        to="/"
                        className="text-xs underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                        Ver Dashboard →
                    </Link>
                </div>
            )}
        </div>
    );
}
