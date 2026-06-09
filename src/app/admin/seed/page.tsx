"use client";

import { useState } from "react";

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; count?: number; error?: string } | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/seed", {
        method: "POST",
        headers: {
          Authorization: "Bearer seed-token-123456"
        }
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          模型数据初始化
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          点击按钮执行数据库种子脚本，初始化所有可用的 AI 模型配置。
        </p>

        <button
          onClick={handleSeed}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? "执行中..." : "执行种子脚本"}
        </button>

        {result && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              result.success
                ? "bg-green-100 dark:bg-green-900"
                : "bg-red-100 dark:bg-red-900"
            }`}
          >
            {result.success ? (
              <>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  ✅ 成功
                </h3>
                <p className="text-green-700 dark:text-green-300 mt-2">
                  {result.message}
                </p>
                <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                  已初始化 {result.count} 个模型
                </p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  ❌ 失败
                </h3>
                <p className="text-red-700 dark:text-red-300 mt-2 break-all">
                  {result.error}
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
            将初始化的模型：
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• MiMo-V2.5</li>
            <li>• MiMo-V2.5-Pro</li>
            <li>• DeepSeek-V4-pro</li>
            <li>• Agnes Text Flash (免费)</li>
            <li>• Agnes Image V2.1 (免费)</li>
            <li>• Agnes Video V2.0 (免费)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
