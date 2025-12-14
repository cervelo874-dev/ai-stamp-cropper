import { useState, useCallback } from 'react';
import { useBackgroundRemoval } from './hooks/useBackgroundRemoval';
import { useObjectSegmenter, type SegmentedObject } from './hooks/useObjectSegmenter';
import { LoadingScreen } from './components/LoadingScreen';
import { Editor } from './components/Editor';
import { Upload, ImageIcon } from 'lucide-react';

// New: Map to store source data
export interface SourceData {
  id: string; // uuid
  url: string; // original blob url
  bitmap: ImageBitmap; // processed transparent bitmap
}

function App() {
  const { processImage, status: bgStatus, progress: bgProgress } = useBackgroundRemoval();
  const { segmentImage, isSegmenting } = useObjectSegmenter();

  // Multi-image state
  const [sourceImages, setSourceImages] = useState<Map<string, string>>(new Map());
  const [processedBitmaps, setProcessedBitmaps] = useState<Map<string, ImageBitmap>>(new Map());
  const [allSegments, setAllSegments] = useState<SegmentedObject[]>([]);

  const [appState, setAppState] = useState<'upload' | 'processing' | 'editor'>('upload');

  // Batch progress state
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setTotalFiles(files.length);
    setCurrentFileIndex(0);
    setAppState('processing');

    const newSourceImages = new Map(sourceImages);
    const newProcessedBitmaps = new Map(processedBitmaps);
    let newSegments: SegmentedObject[] = [...allSegments];

    try {
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i + 1);
        const file = files[i];
        const sourceId = crypto.randomUUID();
        const url = URL.createObjectURL(file);

        newSourceImages.set(sourceId, url);

        // 1. Remove Background
        const bitmap = await processImage(url);
        newProcessedBitmaps.set(sourceId, bitmap);

        // 2. Segment Objects
        const segs = await segmentImage(bitmap, sourceId);
        newSegments = [...newSegments, ...segs];
      }

      // Update State once
      setSourceImages(newSourceImages);
      setProcessedBitmaps(newProcessedBitmaps);
      setAllSegments(newSegments);
      setAppState('editor');

    } catch (e) {
      console.error("Batch processing failed", e);
      alert("Some images failed to process.");
      setAppState('editor'); // Go to editor anyway with what we have? Or back to upload?
      // If we have some segments, go to editor.
      if (newSegments.length > 0) {
        setSourceImages(newSourceImages);
        setProcessedBitmaps(newProcessedBitmaps);
        setAllSegments(newSegments);
        setAppState('editor');
      } else {
        setAppState('upload');
      }
    }
  }, [processImage, segmentImage, sourceImages, processedBitmaps, allSegments]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const reset = () => {
    setSourceImages(new Map());
    setProcessedBitmaps(new Map());
    setAllSegments([]);
    setAppState('upload');
  };

  // Determine Loading Status
  const isWorkerBusy = bgStatus === 'loading' || bgStatus === 'downloading' || bgStatus === 'processing';
  const isLoading = appState === 'processing' || isWorkerBusy || isSegmenting;

  // Calculate aggregated progress
  const singleFileProgress = bgStatus === 'downloading' ? bgProgress : (isSegmenting ? 90 : (bgStatus === 'processing' ? 50 : 0));
  // Total progress roughly: ((currentIndex - 1) * 100 + singleProgress) / total
  const totalProgress = totalFiles > 0
    ? ((currentFileIndex - 1) * 100 + singleFileProgress) / totalFiles
    : 0;

  let loadingText = `Processing image ${currentFileIndex} of ${totalFiles}...`;
  if (bgStatus === 'loading' || bgStatus === 'downloading') loadingText = "Loading AI Model...";

  return (
    <div className="min-h-screen bg-neo-white font-sans text-neo-black">
      {isLoading && <LoadingScreen progress={totalProgress} status={loadingText} />}

      {appState === 'editor' && (
        <Editor
          sourceImages={sourceImages}
          processedBitmaps={processedBitmaps}
          initialSegments={allSegments}
          onReset={reset}
        />
      )}

      {appState === 'upload' && !isLoading && (
        <div
          className="h-screen w-full flex flex-col items-center justify-center p-4 border-8 border-neo-black bg-[radial-gradient(#00000018_1px,transparent_1px)] [background-size:16px_16px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="bg-white p-8 border-4 border-neo-black shadow-neo-lg text-center max-w-lg w-full">
            <div className="w-20 h-20 bg-neo-green border-3 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-neo">
              <ImageIcon size={40} />
            </div>

            <h1 className="text-4xl font-black italic mb-2 uppercase">AI Stamp Cropper</h1>
            <p className="font-bold mb-8">Drop multiple images here to auto-stamp them.</p>

            <label className="neo-btn cursor-pointer inline-flex items-center gap-2 text-lg px-8 py-4">
              <Upload size={24} />
              <span>UPLOAD IMAGES</span>
              <input type="file" className="hidden" accept="image/*" multiple onChange={handleInputChange} />
            </label>

            <div className="mt-8 text-sm opacity-60 font-bold border-t-2 border-black pt-4">
              POWERED BY TRANSFORMERS.JS
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
