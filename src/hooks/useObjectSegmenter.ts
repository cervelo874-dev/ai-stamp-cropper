import { useCallback, useState } from 'react';

export interface SegmentedObject {
    id: string;
    sourceId: string; // New: ID of the source image
    url: string; // Blob URL of the segmented stamp
    width: number;
    height: number;
    x: number;
    y: number;
}

export function useObjectSegmenter() {
    const [isSegmenting, setIsSegmenting] = useState(false);

    const segmentImage = useCallback(async (imageBitmap: ImageBitmap, sourceId: string): Promise<SegmentedObject[]> => {
        setIsSegmenting(true);
        try {
            // 1. Draw to canvas to get pixel data
            const width = imageBitmap.width;
            const height = imageBitmap.height;
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('Failed to get context');

            ctx.drawImage(imageBitmap, 0, 0);
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // 2. Pre-processing: Create binary map & Apply Dilation
            const binaryMap = new Uint8Array(width * height);
            const ALPHA_THRESHOLD = 20;

            for (let i = 0; i < width * height; i++) {
                if (data[i * 4 + 3] > ALPHA_THRESHOLD) binaryMap[i] = 1;
            }

            const dilatedMap = new Uint8Array(width * height);
            const kernelSize = 15;

            // Pass 1: Horizontal Dilation
            const tempMap = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (binaryMap[idx]) {
                        const start = Math.max(0, x - kernelSize);
                        const end = Math.min(width - 1, x + kernelSize);
                        for (let k = start; k <= end; k++) {
                            tempMap[y * width + k] = 1;
                        }
                    }
                }
            }

            // Pass 2: Vertical Dilation
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (tempMap[idx]) {
                        const start = Math.max(0, y - kernelSize);
                        const end = Math.min(height - 1, y + kernelSize);
                        for (let k = start; k <= end; k++) {
                            dilatedMap[k * width + x] = 1;
                        }
                    }
                }
            }

            // 3. Connected Component Labeling
            const visited = new Uint8Array(width * height);
            const objects: { minX: number, minY: number, maxX: number, maxY: number, pixels: number[] }[] = [];
            const getIdx = (x: number, y: number) => (y * width + x);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = getIdx(x, y);

                    if (visited[idx] || dilatedMap[idx] === 0) continue;

                    // BFS
                    const queue = [idx];
                    visited[idx] = 1;

                    let minX = x, maxX = x, minY = y, maxY = y;
                    const componentPixels: number[] = [];

                    let head = 0;
                    while (head < queue.length) {
                        const currIdx = queue[head++];
                        componentPixels.push(currIdx);

                        const cx = currIdx % width;
                        const cy = Math.floor(currIdx / width);

                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;

                        const neighbors = [
                            { nx: cx + 1, ny: cy },
                            { nx: cx - 1, ny: cy },
                            { nx: cx, ny: cy + 1 },
                            { nx: cx, ny: cy - 1 }
                        ];

                        for (const { nx, ny } of neighbors) {
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nIdx = getIdx(nx, ny);
                                if (!visited[nIdx] && dilatedMap[nIdx] === 1) {
                                    visited[nIdx] = 1;
                                    queue.push(nIdx);
                                }
                            }
                        }
                    }

                    // Filter noise
                    const widthBox = maxX - minX + 1;
                    const heightBox = maxY - minY + 1;
                    const areaBox = widthBox * heightBox;

                    if (areaBox > 900 || componentPixels.length > 200) {
                        let rMinX = width, rMaxX = 0, rMinY = height, rMaxY = 0;
                        let hasContent = false;

                        for (let ry = minY; ry <= maxY; ry++) {
                            for (let rx = minX; rx <= maxX; rx++) {
                                const rIdx = ry * width + rx;
                                if (data[rIdx * 4 + 3] > ALPHA_THRESHOLD) {
                                    hasContent = true;
                                    if (rx < rMinX) rMinX = rx;
                                    if (rx > rMaxX) rMaxX = rx;
                                    if (ry < rMinY) rMinY = ry;
                                    if (ry > rMaxY) rMaxY = ry;
                                }
                            }
                        }

                        if (hasContent) {
                            const PADDING = 10;
                            let fMinX = Math.max(0, rMinX - PADDING);
                            let fMinY = Math.max(0, rMinY - PADDING);
                            let fMaxX = Math.min(width - 1, rMaxX + PADDING);
                            let fMaxY = Math.min(height - 1, rMaxY + PADDING);

                            // Ensure Even Dimensions
                            let boxWidth = fMaxX - fMinX + 1;
                            let boxHeight = fMaxY - fMinY + 1;

                            if (boxWidth % 2 !== 0) {
                                if (fMaxX < width - 1) fMaxX++;
                                else if (fMinX > 0) fMinX--;
                            }
                            if (boxHeight % 2 !== 0) {
                                if (fMaxY < height - 1) fMaxY++;
                                else if (fMinY > 0) fMinY--;
                            }

                            objects.push({
                                minX: fMinX, minY: fMinY,
                                maxX: fMaxX, maxY: fMaxY,
                                pixels: []
                            });
                        }
                    }
                }
            }

            // 4. Extract Objects
            const results: SegmentedObject[] = await Promise.all(objects.map(async (obj, index) => {
                const objWidth = obj.maxX - obj.minX + 1;
                const objHeight = obj.maxY - obj.minY + 1;

                const objCanvas = new OffscreenCanvas(objWidth, objHeight);
                const objCtx = objCanvas.getContext('2d');
                if (!objCtx) throw new Error('Ctx error');

                objCtx.drawImage(imageBitmap,
                    obj.minX, obj.minY, objWidth, objHeight,
                    0, 0, objWidth, objHeight
                );

                const blob = await objCanvas.convertToBlob({ type: 'image/png' });
                const url = URL.createObjectURL(blob);

                return {
                    id: `obj-${sourceId}-${index}-${Date.now()}`,
                    sourceId,
                    url,
                    width: objWidth,
                    height: objHeight,
                    x: obj.minX,
                    y: obj.minY
                };
            }));

            setIsSegmenting(false);
            return results;

        } catch (e) {
            console.error(e);
            setIsSegmenting(false);
            return [];
        }
    }, []);

    return { segmentImage, isSegmenting };
}
