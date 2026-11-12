import type { Actor, AmountSource, GatheringStatus, InvoiceStatus } from "../../lib/types/circle-view.type";
import type { Language } from "../../lib/types/language.type";

type Details = Record<string, unknown>;
type Money = (cents: unknown) => string;

const membersEn = (count: number) => (count === 1 ? "1 member" : `${count} members`);

// Arabic counts: 1 and 2 take their own forms, 3 to 10 the plural, 11 and up the singular.
function membersAr(count: number): string {
  if (count === 1) return "عضوة وحدة";
  if (count === 2) return "عضوتين";
  if (count >= 3 && count <= 10) return `${count} عضوات`;
  return `${count} عضوة`;
}

export type Copy = {
  appName: string;
  tagline: string;
  tabs: { circle: string; assistant: string; approvals: string; activity: string };
  menu: { open: string; language: string; newCircle: string; sandbox: string };
  common: { loading: string; retry: string; loadError: string; back: string; notFound: string };
  board: {
    gathering: (index: number, total: number) => string;
    inThePot: string;
    ofPledged: (amount: string) => string;
    hostThisTime: string;
    paid: string;
    paidOf: (paid: number, total: number) => string;
    thisGathering: string;
    hostRow: string;
    receivesPot: string;
    noInvoice: string;
    invoiceStatus: Record<InvoiceStatus, string>;
    amountSource: (source: AmountSource, host: string, member: string, amount: string) => string;
    paidOn: (day: string) => string;
    rotation: string;
    gatheringStatus: Record<GatheringStatus, string>;
    reviewPayout: (host: string) => string;
    askToPropose: string;
    payingOut: (host: string) => string;
    noInvoicesYet: string;
    sendInvoices: string;
    circleComplete: string;
  };
  chat: {
    title: string;
    subtitle: string;
    placeholder: string;
    send: string;
    thinking: string;
    failed: string;
    onboardingTitle: string;
    onboardingBody: string;
    onboardingRules: string[];
    examples: string[];
    circleHint: (circle: string) => string;
    circlePrompts: string[];
    members: (count: number) => string;
    schedule: string;
    monthlyFrom: (month: string) => string;
    amount: string;
    usualAmount: (amount: string) => string;
    eachChooses: string;
    rotation: string;
    sendInvoices: string;
    sendInvoicesMessage: string;
    openCircle: string;
    reviewPayout: string;
  };
  approvals: {
    kicker: (index: number, circle: string) => string;
    potComplete: (paid: number) => string;
    closed: (count: number) => string;
    readyFor: (host: string) => string;
    receives: (host: string) => string;
    from: string;
    ownAmounts: (count: number) => string;
    range: string;
    proposedBy: string;
    assistantAgo: (ago: string) => string;
    sentFrom: string;
    yourPayPal: string;
    showWho: string;
    hideWho: string;
    trust: string;
    approve: (host: string) => string;
    approving: string;
    notNow: string;
    emptyTitle: string;
    emptyBody: string;
    payingTitle: (host: string) => string;
    payingBody: string;
    confirmed: (host: string) => string;
  };
  activity: {
    title: string;
    subtitle: string;
    filters: { all: string; money: string; assistant: string; you: string };
    actors: Record<Actor, string>;
    today: string;
    yesterday: string;
    empty: string;
    describe: (action: string, details: Details, money: Money) => string;
  };
};

const en: Copy = {
  appName: "Altın",
  tagline: "The treasurer for your savings circle",
  tabs: { circle: "Circle", assistant: "Assistant", approvals: "Approvals", activity: "Activity" },
  menu: { open: "More", language: "العربية", newCircle: "Start a new circle", sandbox: "PayPal sandbox demo. No real money moves." },
  common: {
    loading: "Loading…",
    retry: "Try again",
    loadError: "Couldn't load the circle.",
    back: "Back",
    notFound: "This circle doesn't exist. Start a new one with the assistant.",
  },
  board: {
    gathering: (index, total) => `Gathering ${index} of ${total}`,
    inThePot: "In the pot",
    ofPledged: (amount) => `of ${amount} invoiced`,
    hostThisTime: "Host this time",
    paid: "Paid",
    paidOf: (paid, total) => `${paid} of ${total}`,
    thisGathering: "This gathering",
    hostRow: "Host",
    receivesPot: "Receives the pot",
    noInvoice: "No invoice yet",
    invoiceStatus: { draft: "Draft", sent: "Invoice sent", partially_paid: "Part paid", paid: "Paid", closed: "Closed" },
    amountSource: (source, host, member, amount) =>
      source === "payback"
        ? `${host} gave ${amount} at ${member}'s gathering`
        : source === "usual"
          ? "Usual amount"
          : "Amount you set",
    paidOn: (day) => `Paid ${day}`,
    rotation: "Rotation",
    gatheringStatus: {
      upcoming: "Upcoming",
      collecting: "Collecting",
      pot_complete: "Pot complete",
      releasing: "Paying out",
      released: "Paid out",
    },
    reviewPayout: (host) => `Pot complete. Review the payout to ${host}`,
    askToPropose: "Pot complete. Ask the assistant to prepare the payout.",
    payingOut: (host) => `Paying ${host}. Waiting for PayPal to confirm…`,
    noInvoicesYet: "No invoices yet for this gathering.",
    sendInvoices: "Ask the assistant to send them",
    circleComplete: "Every gathering is paid out. This circle is complete.",
  },
  chat: {
    title: "Assistant",
    subtitle: "Runs the circle · never moves money without you",
    placeholder: "Message the assistant…",
    send: "Send",
    thinking: "Thinking…",
    failed: "The assistant couldn't answer. Try again.",
    onboardingTitle: "Set up your circle in one message",
    onboardingBody: "Tell me who's in, the order, and the first month. Arabic or English.",
    onboardingRules: [
      "Each member gives what she chooses. A usual amount is only a default.",
      "I send the PayPal invoices and track who paid.",
      "I can prepare a payout, but only you can approve it.",
    ],
    examples: [
      "Ten of us, about 1000 riyals a month, starting December. My sister Mariam goes first for her wedding.",
      "Five friends, Aisha, Bella, Chloe, Dana and Eve in that order, starting January. Call it Sunday Circle.",
    ],
    circleHint: (circle) => `Ask me anything about ${circle}.`,
    circlePrompts: ["Send this gathering's invoices.", "Has everyone paid? If so, prepare the payout."],
    members: membersEn,
    schedule: "Schedule",
    monthlyFrom: (month) => `Monthly from ${month}`,
    amount: "Amount",
    usualAmount: (amount) => `Usual ${amount}, each can change it`,
    eachChooses: "Each member chooses",
    rotation: "Rotation",
    sendInvoices: "Send invoices",
    sendInvoicesMessage: "Send this gathering's invoices.",
    openCircle: "Open circle",
    reviewPayout: "Review payout",
  },
  approvals: {
    kicker: (index, circle) => `Gathering ${index} · ${circle}`,
    potComplete: (paid) => `Pot complete · ${paid} paid`,
    closed: (count) => `${count} closed without paying`,
    readyFor: (host) => `ready for ${host}`,
    receives: (host) => `${host} receives`,
    from: "From",
    ownAmounts: (count) => `${membersEn(count)}, own amounts`,
    range: "Largest · smallest",
    proposedBy: "Proposed by",
    assistantAgo: (ago) => `Assistant · ${ago}`,
    sentFrom: "Sent from",
    yourPayPal: "Your PayPal business account",
    showWho: "See who gave what",
    hideWho: "Hide",
    trust:
      "Altın never holds the money. PayPal sends it from your account, and only you can approve it. The assistant can propose, never pay.",
    approve: (host) => `Approve payout to ${host}`,
    approving: "Sending to PayPal…",
    notNow: "Not now",
    emptyTitle: "Nothing to approve",
    emptyBody: "When every invoice is paid, the assistant prepares the payout and it waits here for you.",
    payingTitle: (host) => `Paying ${host}`,
    payingBody: "PayPal accepted the payout. Waiting for it to confirm, usually under a minute.",
    confirmed: (host) => `PayPal confirmed the payout. ${host} has her pot.`,
  },
  activity: {
    title: "Activity",
    subtitle: "Every action and every dollar, in order. Nothing is edited or deleted.",
    filters: { all: "All", money: "Money", assistant: "Assistant", you: "You" },
    actors: { agent: "Assistant", organizer: "You", paypal: "PayPal", system: "Altın" },
    today: "Today",
    yesterday: "Yesterday",
    empty: "Nothing has happened in this circle yet.",
    describe: (action, d, money) => {
      switch (action) {
        case "circle_created":
          return `Created the circle with ${d.members} members`;
        case "invoice_sent":
          return `Sent ${d.member} an invoice for gathering ${d.month}`;
        case "invoice_paid":
          return `${d.member} paid`;
        case "payout_proposed":
          return `Pot complete. Proposed the payout for your approval`;
        case "tool_failed":
          return `Was stopped: ${d.error}`;
        case "payout_approved":
          return `Approved the payout for gathering ${d.month}`;
        case "payout_refused":
          return `Refused the payout: ${d.reason}`;
        case "payout_requested":
          return `Asked PayPal to send ${money(d.amountCents)}`;
        case "payout_created":
          return "Accepted the payout";
        case "payout_failed":
          return `Rejected the payout: ${d.error}`;
        case "payout_succeeded":
          return `Paid out gathering ${d.month}`;
        case "gathering_started":
          return `Gathering ${d.month} started collecting`;
        case "circle_completed":
          return "Every gathering is paid out. Circle complete";
        default:
          return action;
      }
    },
  },
};

const ar: Copy = {
  appName: "ألتن",
  tagline: "أمينة صندوق جمعيتك",
  tabs: { circle: "الجمعية", assistant: "المساعد", approvals: "الموافقات", activity: "السجل" },
  menu: { open: "المزيد", language: "English", newCircle: "جمعية جديدة", sandbox: "عرض تجريبي على PayPal sandbox، ما فيه فلوس حقيقية." },
  common: {
    loading: "جاري التحميل…",
    retry: "حاولي مرة ثانية",
    loadError: "ما قدرنا نحمّل الجمعية.",
    back: "رجوع",
    notFound: "هالجمعية مو موجودة. ابدئي وحدة جديدة مع المساعد.",
  },
  board: {
    gathering: (index, total) => `الجمعة ${index} من ${total}`,
    inThePot: "في الصندوق",
    ofPledged: (amount) => `من ${amount} بالفواتير`,
    hostThisTime: "صاحبة الدور",
    paid: "دفعوا",
    paidOf: (paid, total) => `${paid} من ${total}`,
    thisGathering: "هالجمعة",
    hostRow: "صاحبة الدور",
    receivesPot: "تستلم الصندوق",
    noInvoice: "ما انرسلت فاتورة",
    invoiceStatus: { draft: "مسودة", sent: "انرسلت الفاتورة", partially_paid: "دفعت جزء", paid: "دفعت", closed: "مقفلة" },
    amountSource: (source, host, member, amount) =>
      source === "payback"
        ? `${host} عطت ${amount} في جمعة ${member}`
        : source === "usual"
          ? "المبلغ المعتاد"
          : "مبلغ حددتيه",
    paidOn: (day) => `دفعت ${day}`,
    rotation: "الأدوار",
    gatheringStatus: {
      upcoming: "قادمة",
      collecting: "نجمع",
      pot_complete: "اكتمل الصندوق",
      releasing: "جاري الصرف",
      released: "انصرفت",
    },
    reviewPayout: (host) => `اكتمل الصندوق. راجعي الصرف لـ${host}`,
    askToPropose: "اكتمل الصندوق. اطلبي من المساعد يجهّز الصرف.",
    payingOut: (host) => `نصرف لـ${host}. ننتظر تأكيد PayPal…`,
    noInvoicesYet: "ما انرسلت فواتير لهالجمعة.",
    sendInvoices: "اطلبي من المساعد يرسلها",
    circleComplete: "انصرفت كل الجمعات. الجمعية خلصت.",
  },
  chat: {
    title: "المساعد",
    subtitle: "يرتّب الجمعية · ما يحرّك أي مبلغ بدون موافقتك",
    placeholder: "اكتبي للمساعد…",
    send: "إرسال",
    thinking: "يفكّر…",
    failed: "المساعد ما قدر يرد. حاولي مرة ثانية.",
    onboardingTitle: "جهّزي جمعيتك برسالة وحدة",
    onboardingBody: "قولي لي مين معك، والترتيب، وأول شهر. بالعربي أو الإنجليزي.",
    onboardingRules: [
      "كل وحدة تحط اللي تختاره. المبلغ المعتاد مجرد اقتراح.",
      "أرسل فواتير PayPal وأتابع مين دفعت.",
      "أجهّز الصرف، بس الموافقة لك أنتِ بس.",
    ],
    examples: [
      "عشر بنات، ألف ريال بالشهر تقريباً، نبدأ ديسمبر، أختي مريم أول وحدة عشان عرسها",
      "خمس صديقات: عائشة، بشرى، شهد، دانة، إيمان بالترتيب، نبدأ يناير. سميها جمعية الأحد",
    ],
    circleHint: (circle) => `اسأليني أي شي عن ${circle}.`,
    circlePrompts: ["أرسلي فواتير هالجمعة.", "دفعوا الكل؟ إذا إي جهّزي الصرف."],
    members: membersAr,
    schedule: "الموعد",
    monthlyFrom: (month) => `كل شهر من ${month}`,
    amount: "المبلغ",
    usualAmount: (amount) => `المعتاد ${amount}، وكل وحدة تقدر تغيّره`,
    eachChooses: "تختاره كل عضوة",
    rotation: "الأدوار",
    sendInvoices: "إرسال الفواتير",
    sendInvoicesMessage: "أرسلي فواتير هالجمعة.",
    openCircle: "فتح الجمعية",
    reviewPayout: "مراجعة الصرف",
  },
  approvals: {
    kicker: (index, circle) => `الجمعة ${index} · ${circle}`,
    potComplete: (paid) => `اكتمل الصندوق · ${paid} دفعوا`,
    closed: (count) => `${count} انقفلت بدون دفع`,
    readyFor: (host) => `جاهز لـ${host}`,
    receives: (host) => `تستلم ${host}`,
    from: "من",
    ownAmounts: (count) => `${membersAr(count)}، كل وحدة بمبلغها`,
    range: "الأعلى · الأقل",
    proposedBy: "اقترحه",
    assistantAgo: (ago) => `المساعد · ${ago}`,
    sentFrom: "يُرسل من",
    yourPayPal: "حسابك التجاري في PayPal",
    showWho: "شوفي مين عطت كم",
    hideWho: "إخفاء",
    trust: "ألتن ما يمسك الفلوس أبداً. PayPal يرسلها من حسابك، والموافقة لك بس. المساعد يقترح، وما يدفع.",
    approve: (host) => `الموافقة على الصرف لـ${host}`,
    approving: "نرسل لـ PayPal…",
    notNow: "مو الحين",
    emptyTitle: "ما فيه شي ينتظر موافقتك",
    emptyBody: "لما تندفع كل الفواتير، المساعد يجهّز الصرف ويوصلك هنا.",
    payingTitle: (host) => `نصرف لـ${host}`,
    payingBody: "PayPal قبل الصرف. ننتظر التأكيد، عادةً أقل من دقيقة.",
    confirmed: (host) => `PayPal أكّد الصرف. ${host} استلمت صندوقها.`,
  },
  activity: {
    title: "السجل",
    subtitle: "كل خطوة وكل دولار بالترتيب. ما ينعدّل ولا ينحذف شي.",
    filters: { all: "الكل", money: "الفلوس", assistant: "المساعد", you: "أنتِ" },
    actors: { agent: "المساعد", organizer: "أنتِ", paypal: "PayPal", system: "ألتن" },
    today: "اليوم",
    yesterday: "أمس",
    empty: "ما صار شي في هالجمعية للحين.",
    describe: (action, d, money) => {
      switch (action) {
        case "circle_created":
          return `سوّى الجمعية بـ${d.members} عضوات`;
        case "invoice_sent":
          return `أرسل فاتورة لـ${d.member} للجمعة ${d.month}`;
        case "invoice_paid":
          return `${d.member} دفعت`;
        case "payout_proposed":
          return "اكتمل الصندوق. جهّز الصرف ينتظر موافقتك";
        case "tool_failed":
          return `انمنع: ${d.error}`;
        case "payout_approved":
          return `وافقتي على الصرف للجمعة ${d.month}`;
        case "payout_refused":
          return `رفض الصرف: ${d.reason}`;
        case "payout_requested":
          return `طلب من PayPal يرسل ${money(d.amountCents)}`;
        case "payout_created":
          return "قبل الصرف";
        case "payout_failed":
          return `رفض الصرف: ${d.error}`;
        case "payout_succeeded":
          return `انصرفت الجمعة ${d.month}`;
        case "gathering_started":
          return `بدينا نجمع للجمعة ${d.month}`;
        case "circle_completed":
          return "انصرفت كل الجمعات. الجمعية خلصت";
        default:
          return action;
      }
    },
  },
};

export const copy: Record<Language, Copy> = { en, ar };
