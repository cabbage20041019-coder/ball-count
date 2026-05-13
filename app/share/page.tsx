"use client";

import { useEffect, useState } from "react";

export default function SharePage() {
  const [count, setCount] = useState<string>("");
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCount(params.get("count") ?? "");
    setTime(params.get("time") ?? "");
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10 text-gray-900 flex flex-col items-center">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-3xl font-bold text-center">
          共有された解析結果
        </h1>

        {count ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
            <p className="text-sm font-bold text-blue-700">ボール数</p>

            <p className="mt-2 text-6xl font-bold text-blue-700">
              {count}
              <span className="ml-2 text-2xl">個</span>
            </p>

            {time && (
              <p className="mt-4 text-sm text-gray-600">
                解析日時：{time}
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            共有データが見つかりません。
          </p>
        )}

        <a
          href="/"
          className="mt-6 block rounded-xl bg-blue-600 px-4 py-3 text-center font-bold text-white hover:bg-blue-700"
        >
          自分も解析する
        </a>
      </div>
    </main>
  );
}
