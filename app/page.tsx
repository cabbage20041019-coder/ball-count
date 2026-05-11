"use client";

import { useState } from "react";

export default function Home() {
  const [fileName, setFileName] = useState("");

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">
        ボールカウント
      </h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (file) {
            setFileName(file.name);
          }
        }}
      />

      {fileName && (
        <p className="mt-4">
          選択した画像：{fileName}
        </p>
      )}
    </main>
  );
}

