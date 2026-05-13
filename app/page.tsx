"use client";

import { useEffect, useRef, useState } from "react";

interface HistoryItem {
  id: string;
  timestamp: string;
  imageUrl: string;
  count: number;
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageGuidance {
  width: number;
  height: number;
  aspectRatio: number;
  requiresSelection: boolean;
  message: string;
}

interface SharedResult {
  count: string;
  time: string;
}

const PRODUCTION_API_URL = "https://ball-count-backend.onrender.com/count";
const HISTORY_STORAGE_KEY = "ball_count_history";
const MIN_SELECTION_SIZE = 12;
const MIN_RECOMMENDED_ASPECT_RATIO = 0.8;
const MAX_RECOMMENDED_ASPECT_RATIO = 1.3;
const MAX_HISTORY_ITEMS = 10;
const HISTORY_IMAGE_MAX_SIZE = 900;
const HISTORY_IMAGE_QUALITY = 0.75;

const loadHistory = () => {
  const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!savedHistory) return [];

  try {
    return JSON.parse(savedHistory) as HistoryItem[];
  } catch {
    return [];
  }
};

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://localhost:8000/count";
  }

  return PRODUCTION_API_URL;
};

const createHistoryImageUrl = (imageUrl: string) => {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(
        1,
        HISTORY_IMAGE_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight)
      );

      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("履歴画像を作成できませんでした"));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", HISTORY_IMAGE_QUALITY));
    };

    image.onerror = () => reject(new Error("履歴画像を読み込めませんでした"));
    image.src = imageUrl;
  });
};

const saveHistoryItems = (items: HistoryItem[]) => {
  const limitedItems = items.slice(0, MAX_HISTORY_ITEMS);

  for (let itemCount = limitedItems.length; itemCount > 0; itemCount -= 1) {
    const itemsToSave = limitedItems.slice(0, itemCount);

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(itemsToSave));
      return itemsToSave;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") {
        throw error;
      }
    }
  }

  throw new Error("履歴の保存容量が足りません");
};

export default function Home() {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRef = useRef<string>("");
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [processedImageUrl, setProcessedImageUrl] = useState<string>("");

  const [count, setCount] = useState<number | "">("");
  const [errorAdjustment, setErrorAdjustment] = useState<number | "">(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [imageGuidance, setImageGuidance] = useState<ImageGuidance | null>(null);
  const [sharedResult, setSharedResult] = useState<SharedResult | null>(null);
  const [shareLink, setShareLink] = useState<string>("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHistory(loadHistory());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCount = params.get("count");
    const sharedTime = params.get("time");

    if (sharedCount && sharedTime) {
      setSharedResult({
        count: sharedCount,
        time: sharedTime,
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    setSelectedFile(file);
    setImageUrl(url);
    setProcessedImageUrl("");
    setCount("");
    setErrorAdjustment(0);
    setSelection(null);
    setImageGuidance(null);
    setSharedResult(null);
    setShareLink("");

    const previewImage = new Image();

    previewImage.onload = () => {
      const aspectRatio = previewImage.naturalWidth / previewImage.naturalHeight;

      const requiresSelection =
        aspectRatio < MIN_RECOMMENDED_ASPECT_RATIO ||
        aspectRatio > MAX_RECOMMENDED_ASPECT_RATIO;

      setImageGuidance({
        width: previewImage.naturalWidth,
        height: previewImage.naturalHeight,
        aspectRatio,
        requiresSelection,
        message: requiresSelection
          ? "画像が縦長または横長です。ボールの範囲だけを選択して解析してください。"
          : "必要に応じてボールの範囲だけを選択できます。",
      });
    };

    previewImage.src = url;
  };

  const getImagePoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const image = imageRef.current;
    if (!image) return null;

    const rect = image.getBoundingClientRect();

    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);

    return { x, y };
  };

  const handleSelectionStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageUrl || isProcessing) return;

    const point = getImagePoint(e);
    if (!point) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = point;

    setSelection({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });
  };

  const handleSelectionMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;

    const point = getImagePoint(e);
    if (!point) return;

    const start = dragStartRef.current;

    setSelection({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  };

  const handleSelectionEnd = () => {
    dragStartRef.current = null;

    setSelection((current) => {
      if (
        !current ||
        current.width < MIN_SELECTION_SIZE ||
        current.height < MIN_SELECTION_SIZE
      ) {
        return null;
      }

      return current;
    });
  };

  const createSelectedImageBlob = async () => {
    if (!selectedFile) return null;

    const image = imageRef.current;
    if (!image || !selection) return selectedFile;

    const scaleX = image.naturalWidth / image.clientWidth;
    const scaleY = image.naturalHeight / image.clientHeight;

    const sourceX = Math.round(selection.x * scaleX);
    const sourceY = Math.round(selection.y * scaleY);
    const sourceWidth = Math.round(selection.width * scaleX);
    const sourceHeight = Math.round(selection.height * scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext("2d");
    if (!context) return selectedFile;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    return new Promise<Blob | File>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ?? selectedFile),
        selectedFile.type || "image/jpeg",
        0.92
      );
    });
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;

    if (imageGuidance?.requiresSelection && !selection) {
      alert("この画像は範囲選択が必要です。ボールの範囲だけをドラッグで選択してください。");
      return;
    }

    setIsProcessing(true);

    const formData = new FormData();

    try {
      const imageBlob = await createSelectedImageBlob();
      if (!imageBlob) throw new Error("画像を読み込めませんでした");

      formData.append("file", imageBlob, selectedFile.name);

      const res = await fetch(getApiUrl(), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("サーバーエラー");

      const data = await res.json();

      if (data.count !== undefined && data.processed_image) {
        setCount(data.count);
        setErrorAdjustment(0);
        setProcessedImageUrl(`data:image/jpeg;base64,${data.processed_image}`);
        setImageUrl("");
        setSelectedFile(null);
        setSelection(null);
        setShareLink("");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("処理に失敗しました。");
    } finally {
      setIsProcessing(false);
    }
  };

  const requiresSelection = imageGuidance?.requiresSelection ?? false;

  const canAnalyze =
    Boolean(selectedFile) &&
    !isProcessing &&
    (!requiresSelection || Boolean(selection));

  const detectedCount = count === "" ? 0 : Number(count);
  const adjustmentCount = errorAdjustment === "" ? 0 : Number(errorAdjustment);
  const totalCount = detectedCount + adjustmentCount;

  const createShareLink = async () => {
    if (count === "") return;

    const timestamp = new Date().toLocaleString("ja-JP");

    const url = new URL("/share", window.location.origin);
    url.searchParams.set("count", String(totalCount));
    url.searchParams.set("time", timestamp);

    const shareUrl = url.toString();

    setShareLink(shareUrl);

    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("共有リンクを作成してコピーしました！");
    } catch {
      alert("共有リンクを作成しました。画面内のリンクから開けます。");
    }
  };

  const saveToHistory = async () => {
    if (!processedImageUrl || count === "") return;

    try {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("ja-JP"),
        imageUrl: await createHistoryImageUrl(processedImageUrl),
        count: totalCount,
      };

      const savedHistory = saveHistoryItems([newItem, ...history]);
      setHistory(savedHistory);

      alert("履歴に保存しました！");
    } catch (error) {
      console.error("History save error:", error);
      alert("履歴の保存容量が足りません。古い履歴を削除してからもう一度保存してください。");
    }
  };

  const deleteHistory = (id: string) => {
    const newHistory = history.filter((item) => item.id !== id);

    setHistory(newHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
  };

  return (
    <main className="min-h-screen p-8 bg-gray-100 text-gray-900 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8">ボールカウント & 履歴保存</h1>

      {sharedResult && (
        <div className="mb-6 w-full max-w-2xl rounded-2xl border border-green-300 bg-green-50 p-4 text-green-900 shadow">
          <p className="font-bold">共有された解析結果</p>
          <p className="mt-1">個数: {sharedResult.count}個</p>
          <p className="text-sm">時間: {sharedResult.time}</p>
        </div>
      )}

      <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-md mb-12">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mb-6 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />

        {isProcessing && (
          <p className="text-center animate-pulse text-blue-600 font-bold">
            解析中...
          </p>
        )}

        {(imageUrl || processedImageUrl) && (
          <div className="flex flex-col items-center">
            {imageUrl ? (
              <>
                <div
                  className="relative max-w-full touch-none select-none cursor-crosshair overflow-hidden rounded-lg border shadow-inner"
                  onPointerDown={handleSelectionStart}
                  onPointerMove={handleSelectionMove}
                  onPointerUp={handleSelectionEnd}
                  onPointerCancel={handleSelectionEnd}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="解析する画像"
                    className="block max-h-[500px] max-w-full object-contain"
                    draggable={false}
                  />

                  <div className="pointer-events-none absolute inset-0 bg-black/15" />

                  {selection && (
                    <div
                      className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]"
                      style={{
                        left: `${selection.x}px`,
                        top: `${selection.y}px`,
                        width: `${selection.width}px`,
                        height: `${selection.height}px`,
                      }}
                    />
                  )}
                </div>

                {imageGuidance && (
                  <div
                    className={`mt-4 w-full rounded-xl border p-4 text-sm ${
                      imageGuidance.requiresSelection
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-blue-200 bg-blue-50 text-blue-900"
                    }`}
                  >
                    <p className="font-bold">{imageGuidance.message}</p>
                    <p className="mt-1">
                      画像サイズ: {imageGuidance.width} x {imageGuidance.height} /
                      縦横比: {imageGuidance.aspectRatio.toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={analyzeImage}
                    disabled={!canAnalyze}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {selection
                      ? "選択範囲を解析する"
                      : requiresSelection
                      ? "範囲を選択してください"
                      : "画像全体を解析する"}
                  </button>

                  {selection && (
                    <button
                      type="button"
                      onClick={() => setSelection(null)}
                      disabled={isProcessing}
                      className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      選択を解除
                    </button>
                  )}
                </div>
              </>
            ) : (
              <img
                src={processedImageUrl}
                alt="Result"
                className="w-full max-h-[500px] object-contain rounded-lg border shadow-inner"
              />
            )}

            {processedImageUrl && (
              <div className="mt-6 w-full flex flex-col items-center gap-4">
                <div className="grid w-full grid-cols-1 gap-3 rounded-xl border bg-gray-50 p-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-end">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-gray-600">
                      検出ボール数
                    </span>
                    <input
                      type="number"
                      value={count}
                      onChange={(e) =>
                        setCount(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-2xl font-bold focus:border-blue-500 focus:outline-none"
                    />
                  </label>

                  <span className="hidden pb-3 text-2xl font-bold text-gray-400 sm:block">
                    +
                  </span>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-gray-600">誤差</span>
                    <input
                      type="number"
                      value={errorAdjustment}
                      onChange={(e) =>
                        setErrorAdjustment(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-2xl font-bold focus:border-blue-500 focus:outline-none"
                    />
                  </label>

                  <span className="hidden pb-3 text-2xl font-bold text-gray-400 sm:block">
                    =
                  </span>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-gray-600">合計</span>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center">
                      <span className="text-3xl font-bold text-blue-700">
                        {totalCount}
                      </span>
                      <span className="ml-1 text-sm font-bold text-blue-700">
                        個
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={saveToHistory}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg"
                >
                  結果を履歴に保存する
                </button>

                <button
                  onClick={createShareLink}
                  className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition shadow-lg"
                >
                  共有リンクを作成する
                </button>

                {shareLink && (
                  <div className="w-full rounded-xl border border-green-300 bg-green-50 p-4 text-green-900">
                    <p className="mb-2 font-bold">共有リンク</p>

                    <a
                      href={shareLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all rounded-lg bg-white p-3 text-sm text-blue-700 underline"
                    >
                      {shareLink}
                    </a>

                    <p className="mt-2 text-xs text-green-800">
                      このリンクを開くと、共有結果ページに飛べます。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          📊 保存された履歴 ({history.length}件)
        </h2>

        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-10">
            履歴はまだありません。
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl shadow border relative group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-400 font-mono">
                    {item.timestamp}
                  </span>
                  <button
                    onClick={() => deleteHistory(item.id)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    削除
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedHistory(item)}
                  className="mb-3 block w-full overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={`${item.timestamp}の履歴画像を全体表示する`}
                >
                  <img
                    src={item.imageUrl}
                    alt="History"
                    className="h-48 w-full object-cover transition duration-200 hover:scale-[1.02]"
                  />
                </button>

                <div className="text-right">
                  <span className="text-xl font-bold text-blue-600">
                    {item.count}
                  </span>
                  <span className="text-sm font-bold ml-1">個</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedHistory(null)}
        >
          <div
            className="flex max-h-full w-full max-w-6xl flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 text-white">
              <div>
                <p className="text-sm text-gray-300">{selectedHistory.timestamp}</p>
                <p className="text-lg font-bold">{selectedHistory.count}個</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHistory(null)}
                className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white"
              >
                閉じる
              </button>
            </div>

            <img
              src={selectedHistory.imageUrl}
              alt="Selected history"
              className="max-h-[calc(100vh-120px)] w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
}
