'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { parseMenuCsv } from '@/features/menu/importarCsv';
import { importarMenuFilasAction } from '@/features/menu/importarMenuActions';
import {
  escanearMenuConIaAction,
  type ProductoDetectado,
} from '@/features/menu/escanearMenuActions';
import { queryKeys } from '@/shared/query/keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { ScrollArea } from '@/shared/ui/scroll-area';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB para fotos de alta resolución o PDFs

type ItemRevision = ProductoDetectado & {
  idTemp: string;
  seleccionado: boolean;
};

export function ImportarDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [tabActiva, setTabActiva] = useState<'ia' | 'csv'>('ia');

  // Estado CSV
  const [archivoCsv, setArchivoCsv] = useState<File | null>(null);
  const [pendingCsv, setPendingCsv] = useState(false);
  const inputCsvRef = useRef<HTMLInputElement>(null);

  // Estado IA
  const [archivoIa, setArchivoIa] = useState<File | null>(null);
  const [previewIaUrl, setPreviewIaUrl] = useState<string | null>(null);
  const [escaneandoIa, setEscaneandoIa] = useState(false);
  const [importandoIa, setImportandoIa] = useState(false);
  const [itemsDetectados, setItemsDetectados] = useState<ItemRevision[]>([]);
  const [categoriasDetectadas, setCategoriasDetectadas] = useState<string[]>([]);
  const [pasoIa, setPasoIa] = useState<'subir' | 'revisar'>('subir');
  const inputIaRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setArchivoCsv(null);
    setArchivoIa(null);
    if (previewIaUrl) {
      URL.revokeObjectURL(previewIaUrl);
      setPreviewIaUrl(null);
    }
    setItemsDetectados([]);
    setCategoriasDetectadas([]);
    setPasoIa('subir');
    setEscaneandoIa(false);
    setImportandoIa(false);
    setPendingCsv(false);
    if (inputCsvRef.current) inputCsvRef.current.value = '';
    if (inputIaRef.current) inputIaRef.current.value = '';
  };

  // Manejo de CSV
  const elegirArchivoCsv = (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      toast.error('Por ahora solo archivos CSV. Descargá la plantilla de ejemplo.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('El archivo supera los 10 MB.');
      return;
    }
    setArchivoCsv(file);
  };

  const handleImportarCsv = async () => {
    if (!archivoCsv || pendingCsv) return;
    setPendingCsv(true);
    try {
      const text = await archivoCsv.text();
      const parsed = parseMenuCsv(text);
      if (!parsed.ok) {
        toast.error(parsed.message, {
          description: parsed.errores?.slice(0, 3).join(' · '),
        });
        return;
      }

      const res = await importarMenuFilasAction(parsed.filas);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.productosMenu() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categoriasMenu() }),
      ]);
      reset();
      onOpenChange(false);
    } catch {
      toast.error('No se pudo leer el archivo. Probá de nuevo.');
    } finally {
      setPendingCsv(false);
    }
  };

  // Manejo de IA (Foto / PDF)
  const elegirArchivoIa = (file: File | null) => {
    if (!file) return;
    const type = file.type.toLowerCase();
    const valid =
      type.startsWith('image/') ||
      type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!valid) {
      toast.error('Por favor seleccioná una imagen (JPG, PNG, WEBP) o un archivo PDF de la carta.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('El archivo supera los 10 MB.');
      return;
    }

    if (previewIaUrl) URL.revokeObjectURL(previewIaUrl);
    setArchivoIa(file);
    if (type.startsWith('image/')) {
      setPreviewIaUrl(URL.createObjectURL(file));
    } else {
      setPreviewIaUrl(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  const handleEscanearConIa = async () => {
    if (!archivoIa || escaneandoIa) return;
    setEscaneandoIa(true);
    try {
      const base64 = await fileToBase64(archivoIa);
      const res = await escanearMenuConIaAction({
        dataBase64: base64,
        mimeType: archivoIa.type || 'image/jpeg',
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      const itemsFormateados: ItemRevision[] = res.productos.map((p, idx) => ({
        ...p,
        idTemp: `temp_${idx}_${Date.now()}`,
        seleccionado: true,
      }));

      setItemsDetectados(itemsFormateados);
      setCategoriasDetectadas(res.categorias);
      setPasoIa('revisar');
      toast.success(
        `¡Carta digitalizada! Se encontraron ${itemsFormateados.length} productos en ${res.categorias.length} categorías.`,
      );
    } catch {
      toast.error('Ocurrió un error al contactar al motor de IA. Probá nuevamente.');
    } finally {
      setEscaneandoIa(false);
    }
  };

  const toggleSeleccionItem = (idTemp: string) => {
    setItemsDetectados((prev) =>
      prev.map((item) =>
        item.idTemp === idTemp ? { ...item, seleccionado: !item.seleccionado } : item,
      ),
    );
  };

  const toggleSeleccionarTodos = () => {
    const todosSeleccionados = itemsDetectados.every((i) => i.seleccionado);
    setItemsDetectados((prev) =>
      prev.map((item) => ({ ...item, seleccionado: !todosSeleccionados })),
    );
  };

  const actualizarCampoItem = (
    idTemp: string,
    campo: keyof ProductoDetectado,
    valor: string | number,
  ) => {
    setItemsDetectados((prev) =>
      prev.map((item) => (item.idTemp === idTemp ? { ...item, [campo]: valor } : item)),
    );
  };

  const eliminarItem = (idTemp: string) => {
    setItemsDetectados((prev) => prev.filter((item) => item.idTemp !== idTemp));
  };

  const handleConfirmarImportacionIa = async () => {
    const paraImportar = itemsDetectados.filter((i) => i.seleccionado);
    if (paraImportar.length === 0) {
      toast.error('Seleccioná al menos un producto para importar.');
      return;
    }

    setImportandoIa(true);
    try {
      const filasFormato = paraImportar.map((item, idx) => ({
        linea: idx + 1,
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        categoria: item.categoria,
        precio: Number(item.precio) || 0,
        disponible: item.disponible,
      }));

      const res = await importarMenuFilasAction(filasFormato);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.productosMenu() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categoriasMenu() }),
      ]);
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Error al guardar los productos en la base de datos.');
    } finally {
      setImportandoIa(false);
    }
  };

  const itemsSeleccionadosCount = itemsDetectados.filter((i) => i.seleccionado).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent
        className={
          pasoIa === 'revisar' && tabActiva === 'ia'
            ? 'sm:max-w-4xl max-h-[min(90dvh,90vh)] flex flex-col p-6'
            : 'sm:max-w-lg max-h-[min(90dvh,90vh)] flex flex-col'
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Importar productos a la carta</span>
          </DialogTitle>
          <DialogDescription>
            Cargá el menú de tu restaurante en segundos usando inteligencia artificial o una
            planilla CSV.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tabActiva}
          onValueChange={(v) => {
            setTabActiva(v as 'ia' | 'csv');
            if (v === 'csv') setPasoIa('subir');
          }}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid grid-cols-2 mb-4 w-full">
            <TabsTrigger value="ia" className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span>Foto / PDF de la Carta (IA)</span>
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex items-center gap-2">
              <FileSpreadsheet className="size-4" />
              <span>Planilla CSV</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: IA GEMINI VISION */}
          <TabsContent value="ia" className="flex-1 min-h-0 flex flex-col gap-4 mt-0">
            {pasoIa === 'subir' ? (
              <div className="space-y-4 py-2">
                <input
                  ref={inputIaRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => elegirArchivoIa(e.target.files?.[0] ?? null)}
                />

                <button
                  type="button"
                  onClick={() => inputIaRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    elegirArchivoIa(e.dataTransfer.files?.[0] ?? null);
                  }}
                  disabled={escaneandoIa}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-accent/40 disabled:opacity-60 cursor-pointer"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm ring-4 ring-primary/5">
                    <Sparkles className="size-6" />
                  </span>

                  {archivoIa ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{archivoIa.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(archivoIa.size / (1024 * 1024)).toFixed(2)} MB · Clic para cambiar archivo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Subí una foto o PDF de la carta del restaurante
                      </p>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Sacale una foto al menú en papel, pizarrón o subí el PDF. La IA lee platos, categorías y precios automáticamente.
                      </p>
                    </div>
                  )}
                </button>

                {previewIaUrl && (
                  <div className="relative overflow-hidden rounded-lg border bg-muted/20 flex justify-center max-h-48 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewIaUrl}
                      alt="Vista previa del menú"
                      className="object-contain max-h-44 rounded"
                    />
                  </div>
                )}

                <DialogFooter className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={escaneandoIa}
                    onClick={() => {
                      reset();
                      onOpenChange(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleEscanearConIa()}
                    disabled={!archivoIa || escaneandoIa}
                    className="gap-2 bg-primary text-primary-foreground font-semibold"
                  >
                    {escaneandoIa ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Leyendo la carta…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Digitalizar con IA
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              /* PASO REVISIÓN IA */
              <div className="flex-1 flex flex-col min-h-0 gap-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Revisión de platos detectados
                      </span>
                      <Badge variant="secondary" className="font-medium text-xs">
                        {itemsSeleccionadosCount} de {itemsDetectados.length} seleccionados
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Podés corregir nombres, categorías o precios antes de agregarlos a la carta.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleSeleccionarTodos}
                    className="text-xs font-medium h-8"
                  >
                    {itemsDetectados.every((i) => i.seleccionado)
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos'}
                  </Button>
                </div>

                {categoriasDetectadas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 py-1">
                    <span className="text-xs text-muted-foreground self-center mr-1">
                      Categorías:
                    </span>
                    {categoriasDetectadas.map((c) => (
                      <Badge key={c} variant="outline" className="text-[11px] py-0 px-2">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}

                <ScrollArea className="flex-1 border rounded-lg p-2 min-h-0">
                  <div className="space-y-2 pr-2">
                    {itemsDetectados.map((item) => (
                      <div
                        key={item.idTemp}
                        className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                          item.seleccionado
                            ? 'bg-card border-border shadow-xs'
                            : 'bg-muted/40 border-dashed border-border/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input
                            type="checkbox"
                            checked={item.seleccionado}
                            onChange={() => toggleSeleccionItem(item.idTemp)}
                            className="size-4 rounded accent-primary cursor-pointer"
                            aria-label={`Seleccionar ${item.nombre}`}
                          />
                          <Input
                            value={item.nombre}
                            onChange={(e) =>
                              actualizarCampoItem(item.idTemp, 'nombre', e.target.value)
                            }
                            placeholder="Nombre del plato"
                            className="h-8 text-sm font-medium flex-1 sm:w-56"
                          />
                        </div>

                        <Input
                          value={item.categoria}
                          onChange={(e) =>
                            actualizarCampoItem(item.idTemp, 'categoria', e.target.value)
                          }
                          placeholder="Categoría"
                          className="h-8 text-xs sm:w-36"
                        />

                        <div className="flex items-center gap-1.5 w-full sm:w-auto sm:ml-auto">
                          <span className="text-xs font-semibold text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={item.precio || ''}
                            onChange={(e) =>
                              actualizarCampoItem(
                                item.idTemp,
                                'precio',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            placeholder="Precio"
                            className="h-8 text-sm font-semibold w-24"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => eliminarItem(item.idTemp)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            title="Descartar plato"
                            aria-label="Descartar plato"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <DialogFooter className="mt-2 pt-2 border-t flex items-center justify-between sm:justify-between w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={importandoIa}
                    onClick={() => setPasoIa('subir')}
                  >
                    Escanear otra carta
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={importandoIa}
                      onClick={() => {
                        reset();
                        onOpenChange(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleConfirmarImportacionIa()}
                      disabled={itemsSeleccionadosCount === 0 || importandoIa}
                      className="gap-1.5 font-semibold"
                    >
                      {importandoIa ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Guardando en la carta…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          Importar {itemsSeleccionadosCount} plato
                          {itemsSeleccionadosCount !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: CSV TRADICIONAL */}
          <TabsContent value="csv" className="flex-1 min-h-0 flex flex-col gap-4 mt-0">
            <input
              ref={inputCsvRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => elegirArchivoCsv(e.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={() => inputCsvRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                elegirArchivoCsv(e.dataTransfer.files?.[0] ?? null);
              }}
              disabled={pendingCsv}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-muted/40 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-accent/40 disabled:opacity-60 cursor-pointer"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-card text-primary shadow-sm">
                <UploadCloud className="size-5" />
              </span>
              {archivoCsv ? (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{archivoCsv.name}</p>
                  <p className="text-xs text-muted-foreground">Hacé clic para elegir otro archivo</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Arrastrá tu archivo o hacé clic para subir
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CSV · hasta 10 MB · máx. 300 productos
                  </p>
                </div>
              )}
            </button>

            <a
              href="/plantillas/menu-ejemplo.csv"
              download
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <FileText className="size-4" />
              Descargar plantilla CSV de ejemplo
            </a>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pendingCsv}
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleImportarCsv()}
                disabled={!archivoCsv || pendingCsv}
              >
                {pendingCsv ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importando…
                  </>
                ) : (
                  'Importar CSV'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
