"use client";

import { useState, useEffect } from "react";

interface Model {
  id: string;
  label: string;
  apiModel: string;
  baseUrl: string | null;
  apiKeyEnvName: string;
  enabled: boolean;
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setModels(data.models);
        } else {
          setError(data.error || "Unknown error");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-red-100 dark:bg-red-900 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 dark:text-red-200 mb-4">
            ❌ 错误
          </h1>
          <p className="text-red-700 dark:text-red-300 break-all">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          模型配置诊断
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
                    标签
                  </th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
                    API Model
                  </th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
                    Base URL
                  </th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
                    Key 变量
                  </th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((model, index) => (
                  <tr
                    key={model.id}
                    className={`${
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-700"
                    } ${!model.enabled ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {model.id}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                      {model.label}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {model.apiModel}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                      {model.baseUrl || "-"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {model.apiKeyEnvName}
                    </td>
                    <td className="px-4 py-2">
                      {model.enabled ? (
                        <span className="text-green-600 dark:text-green-400">
                          ✅ 启用
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">
                          ❌ 禁用
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {models.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              暂无模型数据，请点击下方按钮执行种子脚本
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-4">
          <a
            href="/admin/seed"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            执行种子脚本
          </a>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
          >
            刷新
          </button>
        </div>
      </div>
    </div>
  );
}
