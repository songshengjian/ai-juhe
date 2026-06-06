"use client";

import Image from "next/image";
import { useRef, type ChangeEvent } from "react";
import { FileText, Grid2X2, Image as ImageIcon, List, Search, SlidersHorizontal, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/store/chat-store";

export function LibraryView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const assets = useChatStore((state) => state.assets);
  const uploading = useChatStore((state) => state.uploading);
  const uploadFiles = useChatStore((state) => state.uploadFiles);

  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files?.length) {
      void uploadFiles(event.target.files);
    }
    event.target.value = "";
  }

  return (
    <section className="mx-auto w-full max-w-[920px] flex-1 px-6 pb-10 pt-12">
      <input ref={inputRef} hidden type="file" multiple onChange={handleFiles} />
      <div className="flex items-center justify-between gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">资料库</h1>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="搜索资料库" className="h-10 w-60 rounded-full pl-10" />
          </div>
          <Button
            className="h-10 rounded-full bg-foreground px-5 text-background hover:bg-foreground/85"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "上传中..." : "上传"}
          </Button>
        </div>
      </div>
      <div className="mt-12 flex items-center justify-between">
        <div className="flex gap-1">
          {["全部", "图片", "文件"].map((filter, index) => (
            <Button key={filter} variant={index === 0 ? "secondary" : "ghost"} className="rounded-full font-normal">
              {filter}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Button variant="ghost" size="icon-sm" aria-label="筛选">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon-sm" className="rounded-full" aria-label="网格视图">
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="列表视图">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {assets.length === 0 ? (
        <div className="mt-24 text-center text-sm text-muted-foreground">
          <Upload className="mx-auto mb-4 h-8 w-8" />
          上传照片或文件后，会显示在这里。
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <a
              key={asset.id}
              href={asset.contentUrl}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-2xl border bg-card transition-colors duration-150 ease-in-out hover:bg-accent"
            >
              <div className="flex h-36 items-center justify-center bg-muted">
                {asset.mimeType.startsWith("image/") ? (
                  <Image
                    unoptimized
                    src={asset.contentUrl}
                    width={220}
                    height={144}
                    alt={asset.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileText className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{asset.fileName}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {asset.mimeType.startsWith("image/") ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB
                </p>
                <p className={asset.textExtracted ? "mt-1 text-xs text-primary" : "mt-1 text-xs text-muted-foreground"}>
                  {asset.textExtracted ? "内容已解析，可在聊天中提问" : asset.parseError ?? "暂无解析内容"}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
