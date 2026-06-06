import { FileText, Folder } from "lucide-react";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

interface SharedProjectPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedProjectPage({ params }: SharedProjectPageProps) {
  const { token } = await params;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    include: {
      assets: { orderBy: { createdAt: "desc" }, take: 20 },
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } }
      }
    }
  });
  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-center gap-3">
          <Folder className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">共享项目，只读查看</p>
          </div>
        </header>
        {project.assets.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">项目文件</h2>
            <div className="flex flex-wrap gap-2">
              {project.assets.map((asset) => (
                <a
                  key={asset.id}
                  href={`/api/shared/${token}/files/${asset.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-accent"
                >
                  <FileText className="h-4 w-4" />
                  {asset.fileName}
                </a>
              ))}
            </div>
          </section>
        ) : null}
        <section className="space-y-10">
          {project.conversations.map((conversation) => (
            <article key={conversation.id}>
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">{conversation.title}</h2>
              <div className="space-y-5">
                {conversation.messages.map((message) => (
                  <div key={message.id}>
                    <p className="mb-1 text-xs text-muted-foreground">
                      {message.role === "USER" ? "用户" : "助手"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {project.conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">该项目尚无聊天内容。</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
