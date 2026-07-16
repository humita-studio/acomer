'use server';

import { resolvePostLoginPath } from './session';

/** Destino tras sign-in (admin del local vs panel de plataforma). */
export async function resolvePostLoginPathAction(): Promise<string> {
  return resolvePostLoginPath();
}
