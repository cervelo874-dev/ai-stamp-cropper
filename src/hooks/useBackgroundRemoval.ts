import { useState, useEffect, useRef, useCallback } from 'react';

type ProcessStatus = 'idle' | 'loading' | 'downloading' | 'processing' | 'complete' | 'error';

export function useBackgroundRemoval() {
    const [status, setStatus] = useState<ProcessStatus>('idle');
    const [progress, setProgress] = useState<number>(0);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize worker
        const worker = new Worker(new URL('../workers/bg-remove.worker.ts', import.meta.url), {
            type: 'module',
        });

        worker.onmessage = (event) => {
            const { type, data } = event.data;

            if (type === 'status') {
                if (data.status === 'downloading') {
                    setStatus('downloading');
                    // Estimate total progress if possible, or just pass on file progress
                    if (data.progress) setProgress(data.progress);
                } else if (data.status === 'processing') {
                    setStatus('processing');
                    setProgress(100);
                }
            } else if (type === 'complete') {
                setStatus('complete');
            } else if (type === 'error') {
                setStatus('error');
                console.error("Worker Error:", data);
            }
        };

        workerRef.current = worker;

        return () => {
            worker.terminate();
        };
    }, []);

    const processImage = useCallback((imageUrl: string): Promise<ImageBitmap> => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) return reject('Worker not initialized');

            const handleMessage = (event: MessageEvent) => {
                const { type, data } = event.data;
                if (type === 'complete') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    resolve(data.bitmap);
                } else if (type === 'error') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    reject(data);
                }
            };

            const rawWorker = workerRef.current as Worker;

            const onMessage = (e: MessageEvent) => {
                if (e.data.type === 'complete') {
                    rawWorker.removeEventListener('message', onMessage);
                    resolve(e.data.data.bitmap);
                } else if (e.data.type === 'error') {
                    rawWorker.removeEventListener('message', onMessage);
                    reject(e.data.data);
                }
            };

            rawWorker.addEventListener('message', onMessage);
            rawWorker.postMessage({ type: 'process', data: { imageUrl } });
        });
    }, []);

    return { processImage, status, progress };
}
