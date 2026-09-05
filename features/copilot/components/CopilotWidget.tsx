'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Bike,
  Bot,
  CalendarCheck,
  Check,
  Copy,
  Maximize2,
  Minimize2,
  PauseCircle,
  Percent,
  RotateCcw,
  Sparkles,
  Star,
  TrendingUp,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import {
  ChatBubble,
  ChatBubbleAction,
  ChatBubbleActionWrapper,
  ChatBubbleAvatar,
  ChatBubbleMessage,
  ChatInput,
  ChatMessageList,
} from '@/shared/ui/chat';
import { ToolInvocationRenderer } from './CopilotGenerativeUI';
import { cn } from '@/shared/lib/utils';

const PROMPTS_SUGERIDOS = [
  {
    categoria: 'Ventas',
    texto: '¿Cómo venimos hoy en ventas?',
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    categoria: 'Cocina',
    texto: '¿Cómo está la cocina y qué comandas hay demoradas?',
    icon: UtensilsCrossed,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    categoria: 'Delivery',
    texto: '¿Qué pedidos de delivery tenemos en curso?',
    icon: Bike,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    categoria: 'Reservas',
    texto: '¿Qué reservas hay para hoy?',
    icon: CalendarCheck,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    categoria: 'Caja',
    texto: '¿Cuánto efectivo debería haber en caja?',
    icon: Banknote,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    categoria: 'Precios',
    texto: 'Aumentá 15% los precios de Bebidas',
    icon: Percent,
    color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    categoria: 'Stock',
    texto: 'Pausá el bife de chorizo por falta de stock',
    icon: PauseCircle,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  {
    categoria: 'Reseñas',
    texto: '¿Cómo vienen las opiniones y reseñas de clientes?',
    icon: Star,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
];

function getMessageText(message: UIMessage): string {
  if (!message.parts) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/**
 * Renderiza Markdown enriquecido con GitHub Flavored Markdown (negrita, listas, código, links y tablas)
 */
function MarkdownRenderer({ contenido }: { contenido: string }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            return (
              <Link
                href={href}
                className="font-semibold text-primary underline underline-offset-2 hover:opacity-80 transition-opacity inline-flex items-center gap-0.5"
              >
                {children}
              </Link>
            );
          },
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border">
              <table className="min-w-full text-xs divide-y divide-border">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-muted px-2.5 py-1.5 text-left font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-2.5 py-1 text-muted-foreground">{children}</td>,
        }}
      >
        {contenido}
      </ReactMarkdown>
    </div>
  );
}

/** Store vacío para useSyncExternalStore: el valor no cambia en vida de la página. */
const suscribirNada = () => () => {};

export function CopilotWidget() {
  const [abierto, setAbierto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Instancia de transporte hacia /api/copilot
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/copilot' }), []);

  const { messages, sendMessage, stop, status, error, setMessages } = useChat({
    transport,
    onError: (err) => {
      toast.error(`Error del Copiloto: ${err.message || 'Error de conexión'}`);
    },
  });

  const isGenerating = status === 'streaming' || status === 'submitted';

  // Auto scroll al último mensaje o cambio de streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating]);

  // El atajo se muestra según el sistema: ⌘J en Mac, Ctrl+J en el resto. Con
  // useSyncExternalStore el servidor renderiza Ctrl+J y el cliente corrige sin
  // desajuste de hidratación ni setState dentro de un efecto.
  const esMac = useSyncExternalStore(
    suscribirNada,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
  const atajo = esMac ? '⌘J' : 'Ctrl+J';

  // Atajo de teclado: Cmd+J o Ctrl+J para abrir/cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAbierto((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Foco en input al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [abierto]);

  const handleEnviar = async (textoAEnviar?: string) => {
    const texto = (textoAEnviar || inputVal).trim();
    if (!texto || isGenerating) return;

    setInputVal('');
    await sendMessage({ text: texto });
  };

  const copiarMensaje = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    toast.success('Respuesta copiada al portapapeles');
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const reiniciarChat = () => {
    setMessages([]);
    toast.info('Conversación reiniciada');
  };

  return (
    <>
      {/* BOTÓN FLOTANTE */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-label="Abrir Copiloto IA de ACOMER"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <div className="relative flex items-center justify-center">
          <Sparkles className="size-5 transition-transform group-hover:rotate-12" />
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 ring-1 ring-primary-foreground" />
        </div>
        <span className="text-sm font-semibold hidden sm:inline tracking-tight">Copiloto IA</span>
        <span className="hidden sm:inline-block rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
          {atajo}
        </span>
      </button>

      {/* PANEL DEL COPILOTO */}
      {abierto && (
        <div
          className={cn(
            'fixed inset-y-0 right-0 z-50 bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 transition-all',
            expandido ? 'w-full sm:w-[680px]' : 'w-full sm:w-[460px]'
          )}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b px-4 py-3 bg-card/60 backdrop-blur-xs">
            <div className="flex items-center gap-2.5">
              <div className="relative flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs border border-primary/20">
                <Bot className="size-5" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-foreground tracking-tight">Copiloto ACOMER</h2>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1"
                  >
                    <Sparkles className="size-2.5" />
                    Gemini Flash Lite
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Asistente operativo inteligente
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpandido((prev) => !prev)}
                title={expandido ? 'Achicar panel' : 'Expandir panel'}
                aria-label="Expandir o achicar panel"
              >
                {expandido ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={reiniciarChat}
                title="Reiniciar chat"
                aria-label="Reiniciar conversación"
                disabled={messages.length === 0 || isGenerating}
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setAbierto(false)}
                title="Cerrar"
                aria-label="Cerrar copiloto"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* MENSAJES Y CHAT LIST */}
          <ChatMessageList className="flex-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-2 text-center">
                <div className="relative mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-muted text-primary shadow-xs border border-primary/20">
                  <Sparkles className="size-7" />
                  <span className="absolute -top-1 -right-1 flex size-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-3 bg-emerald-500" />
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  ¿En qué puedo ayudarte hoy?
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs leading-relaxed">
                  Consultá ventas en tiempo real, estado del salón y cocina, o modificá la carta con lenguaje natural.
                </p>

                <div className="mt-6 w-full space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 text-left px-1">
                    Acciones frecuentes
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                    {PROMPTS_SUGERIDOS.map((sug) => {
                      const Icon = sug.icon;
                      return (
                        <button
                          key={sug.texto}
                          type="button"
                          onClick={() => void handleEnviar(sug.texto)}
                          className="group flex flex-col gap-1 rounded-xl border border-border/70 bg-card p-2.5 text-left transition-all hover:border-primary/50 hover:bg-accent/40 hover:shadow-xs active:scale-[0.98] cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={cn('p-1 rounded-md border text-[10px]', sug.color)}>
                              <Icon className="size-3" />
                            </span>
                            <span className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors">
                              {sug.categoria}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                            {sug.texto}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => {
                  const esAsistente = m.role === 'assistant';
                  const textoMensaje = getMessageText(m);

                  if (!esAsistente) {
                    // MENSAJE DEL USUARIO
                    return (
                      <ChatBubble key={m.id} variant="sent">
                        <ChatBubbleAvatar
                          fallback={<User className="size-4 text-primary-foreground" />}
                          className="bg-primary text-primary-foreground border-primary/30"
                        />
                        <div className="flex flex-col items-end max-w-[85%]">
                          <ChatBubbleMessage variant="sent">
                            <p className="whitespace-pre-wrap leading-relaxed">{textoMensaje}</p>
                          </ChatBubbleMessage>
                        </div>
                      </ChatBubble>
                    );
                  }

                  // MENSAJE DEL ASISTENTE CON GENERATIVE UI SEPARADA
                  return (
                    <ChatBubble key={m.id} variant="received">
                      <ChatBubbleAvatar
                        fallback={<Bot className="size-4 text-primary" />}
                        className="bg-primary/10 text-primary border-primary/20"
                      />
                      <div className="flex flex-col items-start w-full min-w-0 space-y-2">
                        {m.parts && m.parts.length > 0 ? (
                          m.parts.map((part, pIdx) => {
                            if (part.type === 'text') {
                              if (!part.text.trim()) return null;
                              return (
                                <ChatBubbleMessage key={pIdx} variant="received" className="w-full">
                                  <MarkdownRenderer contenido={part.text} />
                                </ChatBubbleMessage>
                              );
                            }

                            // Dynamic Tool o Tool-{Name}: Renderiza como CARD independiente (NO dentro de una burbuja gris)
                            if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                              const toolName =
                                'toolName' in part && part.toolName
                                  ? part.toolName
                                  : part.type.replace(/^tool-/, '');
                              const state = 'state' in part ? (part.state as string) : undefined;
                              const args =
                                'input' in part ? (part.input as Record<string, unknown>) : undefined;
                              const result = 'output' in part ? part.output : undefined;

                              return (
                                <div key={pIdx} className="w-full">
                                  <ToolInvocationRenderer
                                    toolName={toolName}
                                    state={state}
                                    args={args}
                                    result={result}
                                  />
                                </div>
                              );
                            }

                            return null;
                          })
                        ) : (
                          <ChatBubbleMessage variant="received" className="w-full">
                            <MarkdownRenderer contenido={textoMensaje} />
                          </ChatBubbleMessage>
                        )}

                        {/* Botón copiar elegante en acción separada */}
                        {textoMensaje.trim() && (
                          <ChatBubbleActionWrapper variant="received">
                            <ChatBubbleAction
                              onClick={() => copiarMensaje(m.id, textoMensaje)}
                              title="Copiar respuesta"
                            >
                              {copiadoId === m.id ? (
                                <>
                                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 ml-1">
                                    Copiado
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" />
                                  <span className="text-[11px] ml-1">Copiar</span>
                                </>
                              )}
                            </ChatBubbleAction>
                          </ChatBubbleActionWrapper>
                        )}
                      </div>
                    </ChatBubble>
                  );
                })}

                {/* Loading indicator con avatar del bot */}
                {isGenerating && (
                  <ChatBubble variant="received">
                    <ChatBubbleAvatar
                      fallback={<Bot className="size-4 text-primary" />}
                      className="bg-primary/10 text-primary border-primary/20"
                    />
                    <div className="flex flex-col items-start min-w-0">
                      <ChatBubbleMessage variant="received" isLoading>
                        <span className="text-xs text-muted-foreground">Consultando información…</span>
                      </ChatBubbleMessage>
                    </div>
                  </ChatBubble>
                )}

                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
                    <span>Ocurrió un error al contactar al copiloto.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleEnviar()}
                      className="h-6 text-xs gap-1"
                    >
                      <RotateCcw className="size-3" />
                      Reintentar
                    </Button>
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            )}
          </ChatMessageList>

          {/* INPUT FORM CON COMPONENTE CHAT INPUT */}
          <div className="border-t p-3 bg-background/80 backdrop-blur-xs">
            <ChatInput
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onSubmit={() => void handleEnviar()}
              onStop={() => stop()}
              isGenerating={isGenerating}
              placeholder="Preguntá algo o pedí una acción (ej: ventas de hoy, pausar plato)…"
            />
          </div>
        </div>
      )}
    </>
  );
}
