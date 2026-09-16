import { useCallback, useEffect, useState } from 'react';
import { Material } from '../types';
import { ApiService } from '../services/api';

/**
 * Authoritative material catalog hook.
 *
 * The material catalog lives in PostgreSQL and is served by GET /api/v1/materials.
 * This hook caches the catalog in memory for the lifetime of the session so the
 * explorer, comparison modal, and manufacturing request flow share one fetch and
 * never drift from the backend.
 */
let cachedMaterials: Material[] | null = null;
let inflightRequest: Promise<Material[] | null> | null = null;

const fetchCatalog = (): Promise<Material[] | null> => {
  if (!inflightRequest) {
    inflightRequest = ApiService.getMaterials()
      .then((materials) => {
        // ApiService returns null when the HTTP request itself fails (it only
        // throws for `requestRequired` calls). A failed catalog fetch must
        // surface as an error, never as an empty list — otherwise the
        // explorer misreports an outage as "no materials match your filters".
        if (materials == null) {
          throw new Error('Material catalog request failed.');
        }
        cachedMaterials = materials;
        return cachedMaterials;
      })
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        inflightRequest = null;
      });
  }
  return inflightRequest;
};

export const useMaterials = (): { materials: Material[]; loading: boolean; error: string | null; refetch: () => void } => {
  const [materials, setMaterials] = useState<Material[]>(cachedMaterials ?? []);
  const [loading, setLoading] = useState<boolean>(!cachedMaterials);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchCatalog()
      .then((result) => {
        setMaterials(result ?? []);
      })
      .catch(() => {
        setError('The material catalog could not be loaded.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (cachedMaterials) {
      setMaterials(cachedMaterials);
      return;
    }
    load();
  }, [load]);

  const refetch = useCallback(() => {
    cachedMaterials = null;
    load();
  }, [load]);

  return { materials, loading, error, refetch };
};

/** Find a catalog record by its id (slugs like `pla`, `abs`, `aluminum`). */
export const materialById = (materials: Material[], id: string | null | undefined): Material | undefined =>
  materials.find((material) => material.id === id) ||
  (id ? materials.find((material) => material.name.toLowerCase() === id.toLowerCase()) : undefined);