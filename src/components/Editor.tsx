import { useState, useRef, useEffect } from 'react';
import type { SegmentedObject } from '../hooks/useObjectSegmenter';
import { ResultGrid } from './ResultGrid';
import { StampEditorModal } from './StampEditorModal';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface EditorProps {
    sourceImages: Map<string, string>; // sourceId -> original blob url
    processedBitmaps: Map<string, ImageBitmap>; // sourceId -> transparent bitmap
    initialSegments: SegmentedObject[];
    onReset: () => void;
}

export const Editor = ({ sourceImages, processedBitmaps, initialSegments, onReset }: EditorProps) => {
    const [segments, setSegments] = useState<SegmentedObject[]>(initialSegments);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [cropShape, setCropShape] = useState<'original' | 'square' | 'circle'>('original');

    // Edit Modal State
    const [editingSegment, setEditingSegment] = useState<SegmentedObject | null>(null);

    // Determine current source based on selection
    const selectedSegment = segments.find(s => s.id === selectedId);

    // Get distinct sourceIds
    const sourceIds = Array.from(sourceImages.keys());
    const currentSourceId = selectedSegment ? selectedSegment.sourceId : (sourceIds.length > 0 ? sourceIds[0] : null);

    const currentOriginalImage = currentSourceId ? sourceImages.get(currentSourceId) : null;
    const currentBitmap = currentSourceId ? processedBitmaps.get(currentSourceId) : null;

    // Filter overlay segments to only show those belonging to the current source image
    const currentViewSegments = segments.filter(s => s.sourceId === currentSourceId);

    // Image & Scaling Refs
    const imageRef = useRef<HTMLImageElement>(null);
    const [scale, setScale] = useState(1);
    const [overlayDims, setOverlayDims] = useState({ width: 0, height: 0, top: 0, left: 0 });

    useEffect(() => {
        const updateDims = () => {
            const img = imageRef.current;
            if (img && currentBitmap) {
                const rect = img.getBoundingClientRect();
                // Rendered dimensions
                setOverlayDims({
                    width: rect.width,
                    height: rect.height,
                    top: 0, // Relative to parent
                    left: 0
                });

                // Calculate Scale: Rendered Width / Natural Width
                const s = rect.width / img.naturalWidth;
                setScale(s);
            }
        };

        updateDims();
        window.addEventListener('resize', updateDims);

        const img = imageRef.current;
        if (img) {
            img.onload = updateDims;
        }

        // Use ResizeObserver for more robust sizing
        let observer: ResizeObserver | null = null;
        if (img) {
            observer = new ResizeObserver(updateDims);
            observer.observe(img);
        }

        return () => {
            window.removeEventListener('resize', updateDims);
            if (observer) observer.disconnect();
        };
    }, [currentOriginalImage, currentBitmap]);

    const handleRemove = (id: string) => {
        const newSegments = segments.filter(s => s.id !== id);
        setSegments(newSegments);
        if (selectedId === id) setSelectedId(null);
    };

    const handleExportAll = async () => {
        const zip = new JSZip();
        // Use Promise.all to fetch all images
        await Promise.all(segments.map(async (seg, index) => {
            const response = await fetch(seg.url);
            const blob = await response.blob();
            zip.file(`stamp-${index + 1}.png`, blob);
        }));

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'stamps.zip');
    };

    // Render Bounding Boxes Overlay for CURRENT IMAGE ONLY
    const renderOverlay = () => {
        if (!scale || !currentViewSegments || overlayDims.width === 0) return null;
        return currentViewSegments.map(seg => (
            <div
                key={seg.id}
                onClick={() => setSelectedId(seg.id)}
                className={`absolute border-2 transition-transform cursor-pointer hover:bg-neo-green/20 ${selectedId === seg.id ? 'border-neo-pink z-10' : 'border-neo-green z-0'}`}
                style={{
                    left: seg.x * scale,
                    top: seg.y * scale,
                    width: seg.width * scale,
                    height: seg.height * scale,
                }}
            >
                {selectedId === seg.id && (
                    <div className="absolute -top-6 left-0 bg-neo-pink text-white text-xs font-bold px-1 whitespace-nowrap">
                        SELECTED
                    </div>
                )}
            </div>
        ));
    };

    const handleEdit = (seg: SegmentedObject) => {
        setEditingSegment(seg);
    };

    const handleSaveEdit = (newUrl: string) => {
        if (!editingSegment) return;

        setSegments(prev => prev.map(s => {
            if (s.id === editingSegment.id) {
                return { ...s, url: newUrl };
            }
            return s;
        }));
        setEditingSegment(null);
    };

    return (
        <div className="flex flex-col h-screen w-full bg-neo-white">
            {/* Edit Modal */}
            {editingSegment && (
                <StampEditorModal
                    segment={editingSegment}
                    sourceImage={sourceImages.get(editingSegment.sourceId) || ''}
                    onSave={handleSaveEdit}
                    onClose={() => setEditingSegment(null)}
                />
            )}

            {/* Top Bar */}
            <header className="h-16 border-b-3 border-black flex items-center justify-between px-4 bg-white z-20 shrink-0">
                <h1 className="text-xl font-bold italic">AI STAMP CROPPER</h1>
                <div className="flex gap-2">
                    <button onClick={onReset} className="neo-btn bg-white text-xs">NEW IMAGES</button>
                    <button onClick={handleExportAll} className="neo-btn text-xs bg-neo-green">EXPORT ALL (ZIP)</button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                {/* Left: Canvas Area */}
                <div className="flex-1 bg-[conic-gradient(at_top_left,#80808033_25%,transparent_25%_50%,#80808033_50%_75%,transparent_75%)] [background-size:20px_20px] relative flex flex-col items-center justify-center overflow-hidden p-8 min-w-0 min-h-0">
                    {/* Background Pattern CSS */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                    />

                    {/* Image Wrapper - Flex centered */}
                    <div className="relative flex items-center justify-center border-3 border-black shadow-neo-lg bg-white" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                        {currentOriginalImage ? (
                            <>
                                <img
                                    ref={imageRef}
                                    src={currentOriginalImage}
                                    alt="Original"
                                    className="block object-contain max-w-full max-h-full"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        display: 'block'
                                    }}
                                />
                                {/* Overlay Container attached to Image Dimensions */}
                                <div
                                    className="absolute inset-0 pointer-events-none"
                                >
                                    <div className="relative w-full h-full pointer-events-auto">
                                        {renderOverlay()}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-64 w-64 bg-white">
                                <span className="text-sm font-bold opacity-50">SELECT A STAMP</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Results / Settings */}
                <div className="h-1/3 md:h-auto md:w-96 border-t-3 md:border-t-0 md:border-l-3 border-black bg-white flex flex-col z-10 shrink-0">
                    <div className="p-4 border-b-3 border-black bg-neo-yellow">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="font-bold border-b-2 border-black inline-block">RESULTS ({segments.length})</h2>
                        </div>

                        <div className="flex gap-2 mb-2 text-xs font-bold">
                            <span className="my-auto">SHAPE:</span>
                            <button onClick={() => setCropShape('original')} className={`px-2 py-1 border-2 border-black ${cropShape === 'original' ? 'bg-neo-black text-white' : 'bg-white hover:bg-gray-100'}`}>ORIGINAL</button>
                            <button onClick={() => setCropShape('square')} className={`px-2 py-1 border-2 border-black ${cropShape === 'square' ? 'bg-neo-black text-white' : 'bg-white hover:bg-gray-100'}`}>SQUARE</button>
                            <button onClick={() => setCropShape('circle')} className={`px-2 py-1 border-2 border-black rounded-full ${cropShape === 'circle' ? 'bg-neo-black text-white' : 'bg-white hover:bg-gray-100'}`}>CIRCLE</button>
                        </div>
                        <p className="text-xs opacity-70">Click box to select. Right click to save.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <ResultGrid items={segments} onRemove={handleRemove} onEdit={handleEdit} shape={cropShape} />
                    </div>
                </div>
            </div>
        </div>
    );
};
