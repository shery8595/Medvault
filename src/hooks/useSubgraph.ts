import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getSubgraphQueryPath } from '../lib/subgraph';
import { fetchFromIndexer, mapQueryToIndexerRoute } from '../lib/indexerClient';

const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL;

// Simple in-memory cache (initial state only; each fetch always hits the network)
const subgraphCache: Record<string, any> = {};

export function useSubgraph<T = any>(query: string, variables?: any, options?: { enabled?: boolean }) {
    const enabled = options?.enabled ?? true;
    const variablesKey = useMemo(() => JSON.stringify(variables ?? {}), [variables]);
    const queryName = query.match(/query\s+([A-Za-z0-9_]+)/)?.[1] ?? 'AnonymousQuery';
    const isPatientQuery = query.includes('query GetPatient');
    const debugPrefix = `[Subgraph:${queryName}]`;
    const cacheKey = useMemo(() => JSON.stringify({ query, variables: variables ?? {} }), [query, variablesKey]);
    const latestRequestKeyRef = useRef<string | null>(null);
    const [data, setData] = useState<T | null>(() => {
        const cached = subgraphCache[cacheKey];
        if (isPatientQuery && cached && (cached as { patient?: unknown }).patient == null) {
            delete subgraphCache[cacheKey];
            return null;
        }
        return cached || null;
    });
    const [loading, setLoading] = useState(enabled && !data);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(
        async (isRefresh = false): Promise<T | null> => {
            if (!enabled) {
                if (isPatientQuery) {
                    console.debug(`${debugPrefix} skipped:disabled`, { variables });
                }
                latestRequestKeyRef.current = null;
                setData(null);
                setLoading(false);
                setError(null);
                return null;
            }

            if (!SUBGRAPH_URL) {
                if (isPatientQuery) console.error(`${debugPrefix} missing VITE_SUBGRAPH_URL`);
                setError(new Error("VITE_SUBGRAPH_URL not set"));
                setLoading(false);
                return null;
            }

            latestRequestKeyRef.current = cacheKey;
            const start = Date.now();
            if (isPatientQuery) {
                console.debug(`${debugPrefix} request:start`, {
                    isRefresh,
                    url: SUBGRAPH_URL,
                    variables,
                    cacheHit: !!subgraphCache[cacheKey],
                });
            }

            try {
                if (!isRefresh && !subgraphCache[cacheKey]) {
                    setLoading(true);
                }

                const indexerRoute = mapQueryToIndexerRoute(query, variables);
                if (indexerRoute) {
                    const indexerData = await fetchFromIndexer<T>(indexerRoute);
                    if (indexerData != null) {
                        if (latestRequestKeyRef.current !== cacheKey) {
                            return null;
                        }
                        subgraphCache[cacheKey] = indexerData;
                        setData(indexerData);
                        setError(null);
                        setLoading(false);
                        return indexerData;
                    }
                }

                const response = await fetch(SUBGRAPH_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables }),
                });
                if (isPatientQuery) {
                    console.debug(`${debugPrefix} request:response`, {
                        status: response.status,
                        ok: response.ok,
                        elapsedMs: Date.now() - start,
                    });
                }

                const result = await response.json();
                if (latestRequestKeyRef.current !== cacheKey) {
                    if (isPatientQuery) {
                        console.debug(`${debugPrefix} request:ignored-stale`, {
                            variables,
                            elapsedMs: Date.now() - start,
                        });
                    }
                    return null;
                }

                if (result.errors) {
                    if (isPatientQuery) console.error(`${debugPrefix} graphql:error`, result.errors);
                    throw new Error(result.errors[0].message);
                }

                // Do not cache "no Patient row yet" — otherwise the Medical Vault stays stuck on a stale
                // `{ patient: null }` after the subgraph indexes the registration (same cacheKey).
                if (isPatientQuery && result.data && (result.data as { patient?: unknown }).patient == null) {
                    delete subgraphCache[cacheKey];
                    console.info(`${debugPrefix} patient:null — not cached (avoids stale empty profile)`, {
                        variables,
                        subgraphQueryPath: getSubgraphQueryPath(SUBGRAPH_URL),
                    });
                } else {
                    subgraphCache[cacheKey] = result.data;
                }
                setData(result.data);
                setError(null);
                if (isPatientQuery) {
                    const p = (result.data as { patient?: { id?: string } | null })?.patient;
                    console.info(`${debugPrefix} request:success`, {
                        hasPatient: !!p,
                        patientId: p?.id ?? null,
                        idMatchesRequested:
                            p?.id != null && variables?.id != null
                                ? String(p.id).toLowerCase() === String(variables.id).toLowerCase()
                                : null,
                        elapsedMs: Date.now() - start,
                    });
                }
                return result.data as T;
            } catch (err: any) {
                if (latestRequestKeyRef.current !== cacheKey) {
                    return null;
                }
                setError(err);
                if (isPatientQuery) {
                    console.error(`${debugPrefix} request:failed`, {
                        message: err?.message ?? String(err),
                        elapsedMs: Date.now() - start,
                    });
                }
                return null;
            } finally {
                if (latestRequestKeyRef.current === cacheKey) {
                    setLoading(false);
                }
            }
        },
        [query, variablesKey, cacheKey, enabled]
    );

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!enabled) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        const cached = subgraphCache[cacheKey];
        if (isPatientQuery && cached && (cached as { patient?: unknown }).patient == null) {
            delete subgraphCache[cacheKey];
        }
        const effective = subgraphCache[cacheKey];
        if (effective) {
            setData(effective);
            setLoading(false);
        } else {
            setData(null);
            setLoading(true);
        }
    }, [cacheKey, enabled]);

    const refetch = useCallback(() => fetchData(true), [fetchData]);

    return {
        data,
        loading,
        error,
        refetch,
    };
}
