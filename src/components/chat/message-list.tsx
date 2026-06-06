"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileText, Image as ImageIcon, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";
import type { ChatMessage } from "@/types";

function MessageActions({
  message,
  canRegenerate,
  align
}: {
  message: ChatMessage;
  canRegenerate: boolean;
  align: "left" | "right";
}) {
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const regenerate = useChatStore((state) => state.regenerateLastResponse);
  const [copied, setCopied] = useState(false);

  async function copyMessage(): Promise<void> {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 opacity-0 transition-opacity duration-150 ease-in-out group-hover:opacity-100 group-focus-within:opacity-100",
        align === "right" && "justify-end"
      )}
    >
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copyMessage()} aria-label="复制">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      {canRegenerate ? (
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => void regenerate()} aria-label="重新生成">
          <RefreshCw className="h-4 w-4" />
        </Button>
      ) : null}
      {!message.pending ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void deleteMessage(message.id)}
          aria-label="删除消息"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function MessageList() {
  const messages = useChatStore((state) => state.messages);
  const loading = useChatStore((state) => state.loadingConversation);
  const endRef = useRef<HTMLDivElement>(null);
  const latestAssistantId = [...messages].reverse().find((message) => message.role === "ASSISTANT")?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">正在加载...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pb-36 pt-8">
        {messages.map((message) => {
          const isUser = message.role === "USER";
          const align = isUser ? "right" : "left";
          return (
            <article
              key={message.id}
              className={cn("group flex w-full", isUser ? "justify-end" : "justify-start")}
            >
              <div className={cn("flex max-w-[85%] flex-col gap-2", isUser ? "items-end" : "items-start")}>
                <div className={cn("text-xs font-medium text-muted-foreground", isUser && "text-right")}>
                  {isUser ? "你" : "镜刻"}
                </div>
                {message.attachments.length > 0 ? (
                  <div className={cn("flex flex-wrap gap-2", isUser && "justify-end")}>
                    {message.attachments.map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex max-w-64 items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm transition-colors duration-150 ease-in-out hover:bg-accent"
                      >
                        {asset.mimeType.startsWith("image/") ? (
                          <ImageIcon className="h-4 w-4 shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{asset.fileName}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
                <div
                  className={cn(
                    "whitespace-pre-wrap text-[15px] leading-7 text-foreground",
                    isUser && "rounded-[24px] bg-accent px-4 py-2.5 text-left"
                  )}
                >
                  {message.thinking && !message.content ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span>思考中</span>
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                      </span>
                    </span>
                  ) : (
                    message.content
                  )}
                  {message.role === "ASSISTANT" && message.pending && !message.thinking && message.content ? (
                    <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-muted-foreground align-middle" />
                  ) : null}
                </div>
                <MessageActions
                  message={message}
                  align={align}
                  canRegenerate={message.role === "ASSISTANT" && message.id === latestAssistantId && !message.pending}
                />
              </div>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
