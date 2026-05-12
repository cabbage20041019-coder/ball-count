"use client";

import { useEffect, useState } from "react";

interface HistoryItem {
  id: string;
  timestamp: string;
  imageUrl: string;
  count: number;
}

const loadHistory = () => {
  const savedHistory = localStorage.getItem("ball_count_history");
  if (!savedHistory) return [];

  try {
    return JSON.parse(savedHistory) as HistoryItem[];
  } catch {
    return [];
  }
};

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [processedImageUrl, setProcessedImageUrl] = useState<string>("");
  const [count, setCount] = useState<number | "">(""); // 個数を数値で管理
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHistory(loadHistory());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setProcessedImageUrl("");
    setCount("");
    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", file);

    
    try {
      const res = await fetch("https://ball-count-backend.onrender.com/count", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("サーバーエラー");

      const data = await res.json();
      if (data.count !== undefined && data.processed_image) {
        setCount(data.count);
        setProcessedImageUrl(`data:image/jpeg;base64,${data.processed_image}`);
        setImageUrl("");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("処理に失敗しました。");
    } finally {
      setIsProcessing(false);
    }
  };

  // 履歴を保存する関数
  const saveToHistory = () => {
    if (!processedImageUrl || count === "") return;

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString("ja-JP"),
      imageUrl: processedImageUrl,
      count: Number(count),
    };

    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    localStorage.setItem("ball_count_history", JSON.stringify(newHistory));
    alert("履歴に保存しました！");
  };

  // 履歴を削除する関数
  const deleteHistory = (id: string) => {
    const newHistory = history.filter((item) => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem("ball_count_history", JSON.stringify(newHistory));
  };

  return (
    <main className="min-h-screen p-8 bg-gray-100 text-gray-900 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8">ボールカウント & 履歴保存</h1>

      {/* メイン操作エリア */}
      <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-md mb-12">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mb-6 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />

        {isProcessing && <p className="text-center animate-pulse text-blue-600 font-bold">解析中...</p>}

        {(imageUrl || processedImageUrl) && (
          <div className="flex flex-col items-center">
            <img
              src={processedImageUrl || imageUrl}
              alt="Result"
              className="w-full max-h-[500px] object-contain rounded-lg border shadow-inner"
            />

            {processedImageUrl && (
              <div className="mt-6 w-full flex flex-col items-center gap-4">
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border">
                  <span className="text-lg font-medium">ボール数：</span>
                  <input
                    type="number"
                    value={count}
                    onChange={(e) => setCount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-24 text-2xl font-bold text-center border-b-2 border-blue-500 bg-transparent focus:outline-none"
                  />
                  <span className="text-lg font-medium">個</span>
                </div>

                <button
                  onClick={saveToHistory}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg"
                >
                  結果を履歴に保存する
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 履歴表示エリア */}
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          📊 保存された履歴 ({history.length}件)
        </h2>
        
        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-10">履歴はまだありません。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {history.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow border relative group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-400 font-mono">{item.timestamp}</span>
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
                  <span className="text-xl font-bold text-blue-600">{item.count}</span>
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
          <div className="flex max-h-full w-full max-w-6xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
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
