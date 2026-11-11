import { useCallback, useEffect } from "react";
import { Button } from "../components/button/button";
import { EmptyState } from "../components/empty-state/empty-state";
import { Loader } from "../components/loader/loader";
import { Menu } from "../components/menu/menu";
import { TabBar } from "../components/tab-bar/tab-bar";
import { useChat } from "../hooks/use-chat/use-chat.hook";
import { useCircle } from "../hooks/use-circle/use-circle.hook";
import { useLanguage } from "../hooks/use-language/use-language.hook";
import { forgetLastCircle, type Tab, useRoute } from "../hooks/use-route/use-route.hook";
import { ActivityPage } from "../modules/activity/activity";
import { ApprovalsPage } from "../modules/approvals/approvals";
import { AssistantPage } from "../modules/assistant/assistant";
import { CirclePage } from "../modules/circle/circle";

export function App() {
  const { language, setLanguage, copy } = useLanguage();
  const [route, navigate] = useRoute();
  const { state, refresh } = useCircle(route.circleId);
  const circle = state.status === "ready" ? state.circle : null;

  const open = useCallback((tab: Tab) => navigate({ circleId: route.circleId, tab }), [navigate, route.circleId]);
  const startNew = useCallback(() => {
    forgetLastCircle();
    navigate({ circleId: null, tab: "assistant" });
  }, [navigate]);
  const chat = useChat(
    route.circleId,
    useCallback((circleId: string) => navigate({ circleId, tab: "assistant" }), [navigate]),
  );

  // Every assistant reply may have changed the circle (created it, sent invoices, proposed a payout).
  const replies = chat.messages.length;
  useEffect(() => {
    if (replies > 0) void refresh();
  }, [replies, refresh]);

  const menu = (
    <Menu
      label={copy.menu.open}
      note={copy.menu.sandbox}
      items={[
        { label: copy.menu.language, onSelect: () => setLanguage(language === "ar" ? "en" : "ar") },
        { label: copy.menu.newCircle, onSelect: startNew },
      ]}
    />
  );

  const page = () => {
    if (route.tab === "assistant" && state.status !== "missing") {
      return (
        <AssistantPage
          circle={circle}
          messages={chat.messages}
          sending={chat.sending}
          failed={chat.failed}
          copy={copy}
          language={language}
          menu={menu}
          onSend={(text) => void chat.send(text)}
          onOpen={open}
        />
      );
    }
    if (state.status === "missing" || state.status === "none") {
      return (
        <EmptyState icon="circle" title={copy.common.notFound} action={<Button onClick={startNew}>{copy.menu.newCircle}</Button>} />
      );
    }
    if (state.status === "error") {
      return (
        <EmptyState icon="circle" title={copy.common.loadError} action={<Button onClick={() => void refresh()}>{copy.common.retry}</Button>} />
      );
    }
    if (state.status === "loading") return <Loader label={copy.common.loading} />;

    const { circle: ready } = state;
    if (route.tab === "approvals") {
      return (
        <ApprovalsPage circle={ready} copy={copy} language={language} menu={menu} onBack={() => open("circle")} onChanged={refresh} />
      );
    }
    if (route.tab === "activity") return <ActivityPage circle={ready} copy={copy} language={language} menu={menu} />;
    return <CirclePage circle={ready} copy={copy} language={language} menu={menu} onOpen={open} />;
  };

  return (
    <div className={route.circleId ? "app has-tabs" : "app"}>
      <main className={`page page-${route.tab}`}>{page()}</main>
      {route.circleId && (
        <TabBar
          value={route.tab}
          onChange={open}
          items={[
            { value: "circle", label: copy.tabs.circle, icon: "circle" },
            { value: "assistant", label: copy.tabs.assistant, icon: "chat" },
            { value: "approvals", label: copy.tabs.approvals, icon: "shield", count: circle?.pendingPayouts.length },
            { value: "activity", label: copy.tabs.activity, icon: "list" },
          ]}
        />
      )}
    </div>
  );
}
