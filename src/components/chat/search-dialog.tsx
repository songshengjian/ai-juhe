"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Search, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/store/chat-store";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const conversations = useChatStore((state) => state.conversations);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const openConversation = useChatStore((state) => state.openConversation);
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      void loadConversations("");
    }
  }, [loadConversations, open]);

  function closeDialog(nextOpen: boolean): void {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery("");
      void loadConversations("");
    }
  }

  function updateQuery(nextQuery: string): void {
    setQuery(nextQuery);
    void loadConversations(nextQuery);
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-[680px] overflow-hidden p-0" hideClose>
        <DialogTitle className="sr-only">搜索聊天</DialogTitle>
        <DialogDescription className="sr-only">
          搜索历史聊天，或开始一个新聊天。
        </DialogDescription>
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="搜索聊天..."
            className="h-10 border-0 px-0 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-xl font-light text-muted-foreground"
            aria-label="关闭搜索"
            onClick={() => closeDialog(false)}
          >
            ×
          </Button>
        </div>
        <div className="min-h-[360px] px-2 py-3">
          <Button
            variant="ghost"
            className="h-12 w-full justify-start bg-accent px-4 font-normal"
            onClick={() => {
              startNewConversation();
              closeDialog(false);
            }}
          >
            <SquarePen className="h-4 w-4" />
            新聊天
          </Button>
          <p className="px-4 pb-2 pt-5 text-xs text-muted-foreground">
            {query ? "搜索结果" : "最近"}
          </p>
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <Button
                key={conversation.id}
                variant="ghost"
                className="h-11 w-full justify-start px-4 font-normal"
                onClick={() => {
                  void openConversation(conversation.id);
                  closeDialog(false);
                }}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="truncate">{conversation.title}</span>
              </Button>
            ))}
            {conversations.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                {query ? "没有匹配的聊天" : "暂无聊天记录"}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
