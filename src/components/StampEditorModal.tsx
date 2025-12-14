import { useRef, useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import type { SegmentedObject } from '../hooks/useObjectSegmenter';

interface StampEditorModalProps {
    segment: SegmentedObject;
    sourceImage: string; // URL of original full image
    onSave: (newUrl: string) => void;
    onClose: () => void;
}

export const StampEditorModal = ({ segment, sourceImage, onSave, onClose }: StampEditorModalProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<'restore' | 'erase'>('erase');
    const [brushSize, setBrushSize] = useState(20);
    const [isDrawing, setIsDrawing] = useState(false);

    // Load images
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imgSource = new Image();
        imgSource.crossOrigin = "anonymous";
        imgSource.src = sourceImage;

        const imgStamp = new Image();
        imgStamp.src = segment.url;

        Promise.all([
            new Promise(r => imgSource.onload = r),
            new Promise(r => imgStamp.onload = r)
        ]).then(() => {
            // Setup canvas size to match the STAMP bounds (plus padding if we want? No, keep segment bounds)
            // But if we want to restore outside bounds, we might need a bigger canvas?
            // For MVP: Restrict editing to the current bounding box of the segment.
            // If they want to restore something WAY outside, they should probably re-crop or we need a bigger logic.
            // Let's stick to current bounds for simplicity.

            canvas.width = segment.width;
            canvas.height = segment.height;

            // Draw Source Image cropped to this area
            // This serves as the "Background" to show what can be restored.
            // We need to keep this in a separate offscreen canvas to redraw it?
            // Actually, we manipulate the ALPHA channel.

            // Approach:
            // 1. Draw the Source Image (cropped) to the canvas.
            // 2. We need to "Mask" it. 
            // Currently, the stamp has transparency.
            // We want to edit the transparency mask.

            // Let's use `globalCompositeOperation`?
            // "destination-in" keeps existing content based on new alpha.

            // BETTER APPROACH:
            // Layer 1 (Bottom): The full Source Image content (cropped). Always visible? No, only visible where mask is 1.
            // Wait, we want to SEE the ghost of the background to know what to restore.
            // So: 
            // Layer 1 (Visual Guide): Source Image (Low Opacity) - To see what to restore.
            // Layer 2 (Active Stamp): The current Stamp.

            // EDITING:
            // We are painting on a MASK.
            // White Brush = Restore (Make pixels visible).
            // Black Brush = Erase (Make pixels transparent).

            // To implement:
            // 1. Create an offscreen canvas `maskCtx` that holds the current Alpha channel.
            //    Initialize it from the `segment.url` image's alpha.
            // 2. Create an offscreen canvas `sourceCtx` holding the cropped source image.

            // On Render (Main Canvas):
            // Clear.
            // Draw `sourceCtx` with opacity 0.3 (Ghost).
            // Draw `sourceCtx` masked by `maskCtx` (The result).

            // On Paint:
            // Draw to `maskCtx`.
            // Request Render.

            init(imgSource, imgStamp);
        });

    }, [segment, sourceImage]);

    // Offscreen buffers
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const init = (imgSource: HTMLImageElement, imgStamp: HTMLImageElement) => {
        const width = segment.width;
        const height = segment.height;

        // 1. Source Canvas (Cropped Original)
        const sCanvas = document.createElement('canvas');
        sCanvas.width = width;
        sCanvas.height = height;
        const sCtx = sCanvas.getContext('2d');
        if (sCtx) {
            sCtx.drawImage(imgSource, segment.x, segment.y, width, height, 0, 0, width, height);
        }
        sourceCanvasRef.current = sCanvas;

        // 2. Mask Canvas (Alpha Channel)
        const mCanvas = document.createElement('canvas');
        mCanvas.width = width;
        mCanvas.height = height;
        const mCtx = mCanvas.getContext('2d');
        if (mCtx) {
            // Draw the stamp. The alpha channel is what we want.
            // If we draw the stamp, we have Color + Alpha.
            // We want a grayscale mask where Opaque = White, Transparent = Black.
            // How to extract?
            mCtx.drawImage(imgStamp, 0, 0);
            const imageData = mCtx.getImageData(0, 0, width, height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // const alpha = data[i + 3]; // Alpha - Unused
                // Set RGB to 255 (White) if we treat it as a mask, but...
                // Actually, let's just use the Alpha channel as the mask value.
                // But for visualization/editing, it's easier if we draw "Color" on this canvas to represent alpha?
                // Let's make this canvas purely for "Compositing".
                // Actually, simplest is:
                // mCtx holds the "Result Image" (RGBA).
                // "Erase" -> compositeOperation 'destination-out', draw brush.
                // "Restore" -> compositeOperation 'source-over', draw from `sourceCanvas` using brush as mask?
                //   No, restoring is tricky if we don't have the source data in the brush.
            }

            // Better Mask Approach:
            // mCanvas comes formatted as: Black background, White shape?
            // Let's just keep `mCanvas` as the "Alpha Mask" (Grayscale).
            // Init:
            //   Draw Stamp.
            //   Composite 'source-in' with White rectangle? -> Result is White shape on Transparent bg.
            //   Draw Black rectangle behind? -> Result is White shape on Black bg.
            mCtx.globalCompositeOperation = 'source-over';
            mCtx.fillStyle = 'black';
            mCtx.fillRect(0, 0, width, height);

            mCtx.globalCompositeOperation = 'source-over';
            mCtx.drawImage(imgStamp, 0, 0);
            // Now we have the stamp over black.
            // But we want the MASK. The stamp has colors.
            // We need to turn non-transparent pixels to White.
            // Complex...

            // Let's go brute force for init.
            mCtx.clearRect(0, 0, width, height);
            mCtx.drawImage(imgStamp, 0, 0);
            const idata = mCtx.getImageData(0, 0, width, height);
            for (let i = 0; i < idata.data.length; i += 4) {
                if (idata.data[i + 3] > 0) {
                    idata.data[i] = 255;
                    idata.data[i + 1] = 255;
                    idata.data[i + 2] = 255;
                    idata.data[i + 3] = 255; // Full opaque white
                } else {
                    idata.data[i] = 0;
                    idata.data[i + 1] = 0;
                    idata.data[i + 2] = 0;
                    idata.data[i + 3] = 0; // Transparent
                    // Actually for a mask we want Opaque Black?
                    // Let's use Alpha for the mask logic.
                    // High Alpha = Keep. Low Alpha = Remove.
                }
            }
            mCtx.putImageData(idata, 0, 0);
        }
        maskCanvasRef.current = mCanvas;

        draw();
    };

    const draw = () => {
        const canvas = canvasRef.current;
        const sCanvas = sourceCanvasRef.current;
        const mCanvas = maskCanvasRef.current;
        if (!canvas || !sCanvas || !mCanvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Checkered Background
        // (Skipped for performance/simplicity, can add css bg)

        // 2. Draw Ghost Source (30% opacity)
        ctx.globalAlpha = 0.3;
        ctx.drawImage(sCanvas, 0, 0);

        // 3. Draw Result (Source masked by Mask)
        ctx.globalAlpha = 1.0;
        // Create a temp canvas for masking
        const tCanvas = document.createElement('canvas');
        tCanvas.width = width;
        tCanvas.height = height;
        const tCtx = tCanvas.getContext('2d');
        if (tCtx) {
            tCtx.drawImage(sCanvas, 0, 0);
            tCtx.globalCompositeOperation = 'destination-in';
            tCtx.drawImage(mCanvas, 0, 0);

            ctx.drawImage(tCanvas, 0, 0);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !maskCanvasRef.current) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const mCtx = maskCanvasRef.current.getContext('2d');
        if (!mCtx) return;

        mCtx.beginPath();
        mCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

        if (tool === 'restore') {
            // Draw White (Opaque)
            mCtx.fillStyle = 'rgba(255,255,255,1)';
            mCtx.globalCompositeOperation = 'source-over';
            mCtx.fill();
        } else {
            // Erase (Transparent)
            mCtx.globalCompositeOperation = 'destination-out';
            mCtx.fill();
        }

        draw();
    };

    // Simple Save
    const handleSave = async () => {
        const sCanvas = sourceCanvasRef.current;
        const mCanvas = maskCanvasRef.current;
        if (!sCanvas || !mCanvas) return;

        const width = sCanvas.width;
        const height = sCanvas.height;

        const tCanvas = document.createElement('canvas');
        tCanvas.width = width;
        tCanvas.height = height;
        const tCtx = tCanvas.getContext('2d');
        if (tCtx) {
            tCtx.drawImage(sCanvas, 0, 0);
            tCtx.globalCompositeOperation = 'destination-in';
            tCtx.drawImage(mCanvas, 0, 0);

            tCanvas.toBlob((blob) => {
                if (blob) {
                    onSave(URL.createObjectURL(blob));
                }
            }, 'image/png');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-neo-white border-4 border-black shadow-neo-lg flex flex-col max-h-full max-w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-2 border-b-2 border-black bg-neo-yellow">
                    <h3 className="font-bold italic">MANUAL EDIT</h3>
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="bg-neo-green border-2 border-black p-1 hover:bg-white text-xs font-bold flex items-center gap-1 px-2">
                            <Check size={14} /> SAVE
                        </button>
                        <button onClick={onClose} className="bg-neo-pink border-2 border-black p-1 hover:bg-white text-xs font-bold px-2">
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-4 p-2 border-b-2 border-black bg-white">
                    <div className="flex gap-1">
                        <button
                            onClick={() => setTool('erase')}
                            className={`px-3 py-1 border-2 border-black text-xs font-bold ${tool === 'erase' ? 'bg-neo-black text-white' : 'bg-white'}`}
                        >
                            ERASER
                        </button>
                        <button
                            onClick={() => setTool('restore')}
                            className={`px-3 py-1 border-2 border-black text-xs font-bold ${tool === 'restore' ? 'bg-neo-black text-white' : 'bg-white'}`}
                        >
                            RESTORE
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">SIZE:</span>
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="w-32 accent-neo-black"
                        />
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-auto bg-[conic-gradient(at_top_left,#ccc_25%,transparent_25%_50%,#ccc_50%_75%,transparent_75%)] [background-size:20px_20px] p-8 flex items-center justify-center">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={() => setIsDrawing(true)}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                        onMouseMove={handleMouseMove}
                        className="border-2 border-neo-blue shadow-lg cursor-crosshair bg-transparent"
                    />
                </div>
            </div>
        </div>
    );
};
