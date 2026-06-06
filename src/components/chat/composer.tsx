"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import {
  ArrowUp,
  FileText,
  Folder,
  Globe,
  Image as ImageIcon,
  Mic,
  MoreHorizontal,
  Paperclip,
  Sparkles,
  Square,
  Telescope,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chat-store";
import type { AssetSummary } from "@/types";

interface ComposerProps {
  showSuggestions?: boolean;
  projectName?: string;
}

function AssetIcon({ asset }: { asset: AssetSummary }) {
  if (asset.mimeType.startsWith("image/")) {
    return (
      <Image
        unoptimized
        src={asset.contentUrl}
        width={42}
        height={42}
        alt=""
        className="h-10 w-10 rounded-lg object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
      <FileText className="h-5 w-5" />
    </span>
  );
}

export function Composer({ showSuggestions = false, projectName }: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const draft = useChatStore((state) => state.draft);
  const assets = useChatStore((state) => state.assets);
  const pendingAssets = useChatStore((state) => state.pendingAssets);
  const uploading = useChatStore((state) => state.uploading);
  const setDraft = useChatStore((state) => state.setDraft);
  const uploadFiles = useChatStore((state) => state.uploadFiles);
  const attachAsset = useChatStore((state) => state.attachAsset);
  const removePendingAsset = useChatStore((state) => state.removePendingAsset);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const stopGenerating = useChatStore((state) => state.stopGenerating);
  const lineCount = Math.min(6, Math.max(1, draft.split("\n").length + Math.floor(draft.length / 90)));

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files?.length) {
      void uploadFiles(event.target.files);
    }
    event.target.value = "";
  }

  function hasDraggedFiles(event: DragEvent<HTMLFormElement>): boolean {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(event: DragEvent<HTMLFormElement>): void {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setDraggingFiles(true);
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>): void {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>): void {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDraggingFiles(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>): void {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current = 0;
    setDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      void uploadFiles(files);
    }
  }

  const suggestions = [
    { label: "生成图片", icon: ImageIcon },
    { label: "撰写或编辑", icon: Paperclip },
    { label: "查找资料", icon: Telescope }
  ];

  return (
    <div className="w-full max-w-3xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative rounded-[24px] border border-input bg-background px-3 py-2 shadow-sm transition-shadow duration-150 ease-in-out focus-within:shadow-md"
      >
        {draggingFiles ? (
          <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-[22px] border border-dashed border-primary bg-background/90 text-sm font-medium text-primary shadow-sm backdrop-blur">
            松开即可上传文件或图片
          </div>
        ) : null}
        {pendingAssets.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2 px-1 pt-1">
            {pendingAssets.map((asset) => (
              <div key={asset.id} className="relative flex max-w-56 items-center gap-2 rounded-xl border bg-background p-2 pr-8">
                <AssetIcon asset={asset} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{asset.fileName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {asset.textExtracted
                      ? "已解析文字"
                      : asset.mimeType.startsWith("image/")
                        ? "可视觉识别"
                        : "未提取文字"}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1 h-6 w-6 rounded-full bg-foreground text-background hover:bg-foreground/80"
                  onClick={() => removePendingAsset(asset.id)}
                  aria-label={`移除 ${asset.fileName}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} hidden type="file" multiple onChange={handleFiles} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" type="button" aria-label="添加附件" className="mb-1 shrink-0">
                <span className="text-2xl font-light leading-none">+</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} className="w-72 rounded-2xl p-2">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }}
              >
                <Paperclip className="h-4 w-4" />
                上传照片和文件
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>近期文件</DropdownMenuLabel>
              {assets.slice(0, 4).map((asset) => (
                <DropdownMenuItem key={asset.id} onSelect={() => attachAsset(asset)}>
                  {asset.mimeType.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span className="truncate">{asset.fileName}</span>
                  {asset.textExtracted ? (
                    <span className="ml-auto text-xs text-primary">已解析</span>
                  ) : asset.mimeType.startsWith("image/") ? (
                    <span className="ml-auto text-xs text-primary">视觉</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              {assets.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">尚未上传文件</p>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDraft("创建图片：")}>
                <Sparkles className="h-4 w-4" />
                创建图片
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDraft("深度研究：")}>
                <Telescope className="h-4 w-4" />
                深度研究
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDraft("网页搜索：")}>
                <Globe className="h-4 w-4" />
                网页搜索
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MoreHorizontal className="h-4 w-4" />
                更多
              </DropdownMenuItem>
              {projectName ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Folder className="h-4 w-4" />
                    项目：{projectName}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={lineCount}
            placeholder={projectName ? `在 ${projectName} 中提问` : "有问题，尽管问"}
            aria-label="发送消息"
            className="max-h-40 min-h-10"
          />
          <Button variant="ghost" size="icon-sm" type="button" aria-label="语音输入" className="mb-1 shrink-0">
            <Mic className="h-4 w-4" />
          </Button>
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              onClick={stopGenerating}
              aria-label="停止生成"
              className="mb-0.5 h-10 w-10 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/85"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={(!draft.trim() && pendingAssets.length === 0) || uploading}
              aria-label="发送"
              className="mb-0.5 h-10 w-10 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/85"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          )}
        </div>
      </form>
      {showSuggestions ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {suggestions.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              type="button"
              variant="outline"
              className="h-10 rounded-full px-4 font-normal text-muted-foreground"
              onClick={() => setDraft(`${label}：`)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
