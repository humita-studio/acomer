import { notFound } from 'next/navigation';
import {
  getLocalDetalleAction,
  getTenantPublicBaseUrl,
} from '@/features/platform/platformActions';
import { LocalDetalle } from '@/features/platform/components/LocalDetalle';

export default async function PlatformLocalDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getLocalDetalleAction(id);
  if (!result.success) {
    notFound();
  }

  const publicUrl = await getTenantPublicBaseUrl(result.local.slug);

  return <LocalDetalle local={result.local} publicUrl={publicUrl} />;
}
