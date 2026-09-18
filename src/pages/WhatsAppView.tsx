import React from 'react';
import {
  MessageSquare,
  Globe,
  Save,
  Check,
  Copy,
  Code,
  Clock,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import type { NotificationTemplate } from '../types';

export type MessageCategory = 'order_created' | 'order_expiring' | 'order_expired';
export type LanguageCode = 'en' | 'fr' | 'ar' | 'ru';

export const READY_TEMPLATES: Record<
  MessageCategory,
  Record<LanguageCode, { name: string; content: string }>
> = {
  order_created: {
    en: {
      name: 'Order Delivery (English)',
      content:
        'Hello {customer_name}! Thank you for your order of {product_name} ({plan_name}). Your access is active until {end_date}. Order ID: #{order_id}. Enjoy!'
    },
    fr: {
      name: 'Livraison de Commande (Français)',
      content:
        'Bonjour {customer_name}! Merci pour votre commande de {product_name} ({plan_name}). Votre accès est actif jusqu au {end_date}. Commande #{order_id}.'
    },
    ar: {
      name: 'تسليم الطلب (العربية)',
      content:
        'مرحباً {customer_name}! شكراً لطلبك {product_name} ({plan_name}). اشتراكك نشط ومفعّل حتى {end_date}. رقم الطلب: #{order_id}.'
    },
    ru: {
      name: 'Доставка заказа (Русский)',
      content:
        'Здравствуйте, {customer_name}! Спасибо за заказ {product_name} ({plan_name}). Ваш доступ активен до {end_date}. Заказ #{order_id}.'
    }
  },
  order_expiring: {
    en: {
      name: 'Renewal Reminder (English)',
      content:
        'Dear {customer_name}, your subscription for {product_name} ({plan_name}) will expire in {days_remaining} days on {end_date}. Order #{order_id}. Please reply to renew now and ensure uninterrupted service!'
    },
    fr: {
      name: 'Rappel Expiration (Français)',
      content:
        'Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) expire dans {days_remaining} jours, le {end_date}. Commande #{order_id}. Répondez à ce message pour renouveler et éviter toute coupure de service!'
    },
    ar: {
      name: 'تذكير بقرب الانتهاء (العربية)',
      content:
        'مرحباً {customer_name}، نود تذكيرك بأن اشتراكك في {product_name} ({plan_name}) سينتهي خلال {days_remaining} أيام بتاريخ {end_date}. رقم الطلب: #{order_id}. يرجى الرد لتجديد اشتراكك وتجنب انقطاع الخدمة!'
    },
    ru: {
      name: 'Напоминание об истечении (Русский)',
      content:
        'Уважаемый(ая) {customer_name}, ваша подписка на {product_name} ({plan_name}) истекает через {days_remaining} дн. ({end_date}). Заказ #{order_id}. Напишите нам для продления, чтобы не потерять доступ!'
    }
  },
  order_expired: {
    en: {
      name: 'Expired Follow-up (English)',
      content:
        'Hello {customer_name}, your subscription for {product_name} ({plan_name}) has expired on {end_date}. Order #{order_id}. Would you like to renew your access today? Reply to this message to reactivate immediately!'
    },
    fr: {
      name: 'Abonnement Expiré (Français)',
      content:
        'Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) est désormais expiré (terminé le {end_date}). Commande #{order_id}. Souhaitez-vous renouveler votre accès aujourd\'hui ? Répondez pour le réactiver immédiatement!'
    },
    ar: {
      name: 'انتهاء الاشتراك وتجديده (العربية)',
      content:
        'مرحباً {customer_name}، لقد انتهت صلاحية اشتراكك في {product_name} ({plan_name}) بتاريخ {end_date}. رقم الطلب #{order_id}. هل ترغب في تجديد اشتراكك اليوم؟ تواصل معنا للرد وإعادة تفعيل حسابك فوراً!'
    },
    ru: {
      name: 'Истекший доступ (Русский)',
      content:
        'Здравствуйте, {customer_name}! Срок действия вашей подписки на {product_name} ({plan_name}) истек ({end_date}). Заказ #{order_id}. Хотите продлить доступ прямо сейчас? Ответьте на это сообщение, чтобы возобновить подписку!'
    }
  }
};

const CATEGORY_TABS: {
  id: MessageCategory;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    id: 'order_created',
    label: 'Thank You',
    icon: CheckCircle2,
    activeClass: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25',
    inactiveClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/80'
  },
  {
    id: 'order_expiring',
    label: 'Expiring',
    icon: Clock,
    activeClass: 'bg-amber-500 text-white shadow-sm shadow-amber-500/25',
    inactiveClass: 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100/80'
  },
  {
    id: 'order_expired',
    label: 'Expired',
    icon: RotateCcw,
    activeClass: 'bg-rose-600 text-white shadow-sm shadow-rose-600/25',
    inactiveClass: 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100/80'
  }
];

const LANGUAGE_TABS: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English (US/UK)' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية (Arabic)' },
  { code: 'ru', label: 'Русский (Russian)' }
];

export const WhatsAppView: React.FC = () => {
  const [templates, setTemplates] = React.useState<NotificationTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<MessageCategory>('order_created');
  const [selectedLang, setSelectedLang] = React.useState<LanguageCode>('en');
  const [activeTemplate, setActiveTemplate] = React.useState<NotificationTemplate | null>(null);
  const [content, setContent] = React.useState('');
  const [saveStatus, setSaveStatus] = React.useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [copiedSuccess, setCopiedSuccess] = React.useState(false);

  // Ref to track latest content for debounced autosave and blur
  const contentRef = React.useRef(content);
  contentRef.current = content;

  const categoryRef = React.useRef(selectedCategory);
  categoryRef.current = selectedCategory;

  const langRef = React.useRef(selectedLang);
  langRef.current = selectedLang;

  const activeTemplateRef = React.useRef(activeTemplate);
  activeTemplateRef.current = activeTemplate;

  const debounceTimerRef = React.useRef<any>(null);

  // Live variable preview state
  const [previewVars, setPreviewVars] = React.useState({
    customer_name: 'Alex Johnson',
    product_name: 'Netflix Premium 4K UHD',
    plan_name: '1 Month Shared Profile',
    start_date: '2026-09-14',
    end_date: '2026-10-14',
    price: '$9.99',
    order_id: 'ORD-882194',
    days_remaining: '30'
  });

  // Helper to find existing template from DB list or fallback to ready template
  const getResolvedTemplate = (
    cat: MessageCategory,
    lang: LanguageCode,
    list = templates
  ): NotificationTemplate => {
    const found = list.find((t) => t.event_type === cat && t.language === lang);
    if (found) return found;

    const ready = READY_TEMPLATES[cat][lang];
    return {
      id: `tmpl-${lang}-${cat}`,
      name: ready.name,
      event_type: cat,
      language: lang,
      content: ready.content,
      created_at: new Date().toISOString()
    };
  };

  const updatePreviewVariablesForCategory = (cat: MessageCategory) => {
    if (cat === 'order_created') {
      setPreviewVars((prev) => ({
        ...prev,
        start_date: '2026-09-14',
        end_date: '2026-10-14',
        days_remaining: '30'
      }));
    } else if (cat === 'order_expiring') {
      setPreviewVars((prev) => ({
        ...prev,
        start_date: '2026-08-20',
        end_date: '2026-09-20',
        days_remaining: '3'
      }));
    } else if (cat === 'order_expired') {
      setPreviewVars((prev) => ({
        ...prev,
        start_date: '2026-08-10',
        end_date: '2026-09-10',
        days_remaining: '0'
      }));
    }
  };

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async (
    targetCat: MessageCategory = selectedCategory,
    targetLang: LanguageCode = selectedLang
  ) => {
    try {
      const res = await api.getWhatsAppTemplates();
      const list = res.templates || [];
      setTemplates(list);

      const resolved = getResolvedTemplate(targetCat, targetLang, list);
      setActiveTemplate(resolved);
      setContent(resolved.content);
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
      const resolved = getResolvedTemplate(targetCat, targetLang, []);
      setActiveTemplate(resolved);
      setContent(resolved.content);
    }
  };

  // Core save to database function
  const saveToDatabase = async (
    textToSave: string,
    cat: MessageCategory = categoryRef.current,
    lang: LanguageCode = langRef.current,
    currentTmpl = activeTemplateRef.current
  ) => {
    if (!textToSave.trim()) return;

    setSaveStatus('saving');
    const ready = READY_TEMPLATES[cat][lang];
    const templateId = currentTmpl?.id || `tmpl-${lang}-${cat}`;
    const templateName = currentTmpl?.name || ready.name;

    try {
      const res = await api.saveWhatsAppTemplate({
        id: templateId,
        name: templateName,
        language: lang,
        event_type: cat,
        content: textToSave.trim()
      });

      const updatedTmpl: NotificationTemplate = res.template || {
        id: templateId,
        name: templateName,
        language: lang,
        event_type: cat,
        content: textToSave.trim(),
        created_at: currentTmpl?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setTemplates((prev) => {
        const index = prev.findIndex((t) => t.id === templateId || (t.event_type === cat && t.language === lang));
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedTmpl;
          return next;
        }
        return [...prev, updatedTmpl];
      });

      if (categoryRef.current === cat && langRef.current === lang) {
        setActiveTemplate(updatedTmpl);
      }

      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save to DB:', err);
      setSaveStatus('error');
    }
  };

  // Handle textarea content change with debounced auto-save to DB
  const handleContentChange = (newText: string) => {
    setContent(newText);
    setSaveStatus('unsaved');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveToDatabase(newText, categoryRef.current, langRef.current);
    }, 800);
  };

  // On blur, immediately save if unsaved
  const handleBlur = () => {
    if (saveStatus === 'unsaved') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      saveToDatabase(contentRef.current, categoryRef.current, langRef.current);
    }
  };

  const handleSelectCategory = (cat: MessageCategory) => {
    if (saveStatus === 'unsaved') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      saveToDatabase(contentRef.current, categoryRef.current, langRef.current);
    }

    setSelectedCategory(cat);
    updatePreviewVariablesForCategory(cat);
    const resolved = getResolvedTemplate(cat, selectedLang, templates);
    setActiveTemplate(resolved);
    setContent(resolved.content);
    setSaveStatus('saved');
  };

  const handleSelectLang = (lang: LanguageCode) => {
    if (saveStatus === 'unsaved') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      saveToDatabase(contentRef.current, categoryRef.current, langRef.current);
    }

    setSelectedLang(lang);
    const resolved = getResolvedTemplate(selectedCategory, lang, templates);
    setActiveTemplate(resolved);
    setContent(resolved.content);
    setSaveStatus('saved');
  };

  const handleResetToReady = async () => {
    const ready = READY_TEMPLATES[selectedCategory][selectedLang];
    setContent(ready.content);
    await saveToDatabase(ready.content, selectedCategory, selectedLang);
  };

  const handleManualSave = async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    await saveToDatabase(content, selectedCategory, selectedLang);
  };

  const interpolatePreview = () => {
    let text = content;
    text = text.replace(/{customer_name}/g, previewVars.customer_name);
    text = text.replace(/{product_name}/g, previewVars.product_name);
    text = text.replace(/{plan_name}/g, previewVars.plan_name);
    text = text.replace(/{start_date}/g, previewVars.start_date);
    text = text.replace(/{end_date}/g, previewVars.end_date);
    text = text.replace(/{price}/g, previewVars.price);
    text = text.replace(/{order_id}/g, previewVars.order_id);
    text = text.replace(/{days_remaining}/g, previewVars.days_remaining);
    return text;
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(interpolatePreview());
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageSquare size={22} className="text-emerald-600" />
            WhatsApp Communication & Templates
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-language automated templates for order delivery, renewal reminders, and expired account follow-ups.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetToReady}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            title="Reset text to default"
          >
            <Sparkles size={14} className="text-slate-500" />
            <span>Reset to Default</span>
          </button>

          <button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/25 transition disabled:opacity-50"
          >
            {saveStatus === 'saving' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {/* 1. Message Category Tabs */}
      <div className="space-y-2">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Message Type
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-category-${tab.id}`}
                onClick={() => handleSelectCategory(tab.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
                  isActive ? tab.activeClass : tab.inactiveClass
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'opacity-85'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Languages Tabs */}
      <div className="space-y-2">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Language
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {LANGUAGE_TABS.map((item) => {
            const isActive = selectedLang === item.code;
            return (
              <button
                key={item.code}
                id={`tab-lang-${item.code}`}
                onClick={() => handleSelectLang(item.code)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Globe size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Code size={16} className="text-emerald-600" />
              Template Source Code
            </h3>
            <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
              {activeTemplate?.name || READY_TEMPLATES[selectedCategory][selectedLang].name}
            </span>
          </div>

          <textarea
            rows={8}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleBlur}
            dir={selectedLang === 'ar' ? 'rtl' : 'ltr'}
            placeholder="Write message template here..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-600 transition"
          />

          {/* Dynamic Variables Guide */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-700">Available Template Tags:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                '{customer_name}',
                '{product_name}',
                '{plan_name}',
                '{start_date}',
                '{end_date}',
                '{price}',
                '{order_id}',
                '{days_remaining}'
              ].map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleContentChange(content + ' ' + tag)}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[10px] text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live WhatsApp Bubble Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-600" />
                Live WhatsApp Bubble Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPreview}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                  title="Copy preview text"
                >
                  {copiedSuccess ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedSuccess ? 'Copied' : 'Copy'}</span>
                </button>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  Interpolated
                </span>
              </div>
            </div>

            {/* WhatsApp Chat mockup frame */}
            <div
              className="p-5 rounded-3xl space-y-3"
              style={{
                backgroundColor: '#EFEAE2',
                backgroundImage: 'radial-gradient(#d1c7b7 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }}
            >
              {/* Outgoing Message Bubble */}
              <div
                dir={selectedLang === 'ar' ? 'rtl' : 'ltr'}
                className="bg-[#E7FFDB] text-slate-900 rounded-2xl rounded-tr-xs p-3.5 shadow-xs max-w-sm ml-auto text-xs whitespace-pre-wrap leading-relaxed border border-[#d2f3c2]"
              >
                {interpolatePreview()}
                <div className="text-right text-[10px] text-slate-400 mt-1.5 flex items-center justify-end gap-1">
                  <span>14:30</span>
                  <span className="text-blue-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>

            {/* Simulated Order Context */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Simulated Test Context ({selectedCategory})
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px]">Customer:</span>
                  <span className="font-semibold text-slate-800">{previewVars.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Product:</span>
                  <span className="font-semibold text-slate-800 truncate block">{previewVars.product_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">End Date:</span>
                  <span className="font-semibold text-slate-800">{previewVars.end_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Days Remaining:</span>
                  <span className="font-semibold text-slate-800">{previewVars.days_remaining} days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
