"use client";

import { useEffect, useMemo, useState } from "react";
import { MailCheck, Save, Send, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LABELS,
  sampleEmail,
  type EmailTemplateKey,
} from "@/lib/email-templates";
import type { EmailConfigPublic } from "@/lib/email-settings";

type Form = {
  apiKey: string;
  clearApiKey: boolean;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  adminRecipients: string;
  brandName: string;
  accent: string;
  footerNote: string;
};

type Domain = { name: string; status: string };

const INPUT =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900";
const CARD =
  "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

function toForm(c: EmailConfigPublic): Form {
  return {
    apiKey: "",
    clearApiKey: false,
    fromName: c.fromName,
    fromAddress: c.fromAddress,
    replyTo: c.replyTo,
    adminRecipients: c.adminRecipients.join(", "),
    brandName: c.brand.name,
    accent: c.brand.accent,
    footerNote: c.brand.footerNote,
  };
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function AdminEmailPage() {
  const [config, setConfig] = useState<EmailConfigPublic | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState<"send" | "domains" | null>(null);
  const [testResult, setTestResult] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [domains, setDomains] = useState<Domain[] | null>(null);

  const [template, setTemplate] = useState<EmailTemplateKey>("confirmation");

  useEffect(() => {
    fetch("/api/admin/email-config", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Gagal memuat konfigurasi email");
        setConfig(data.config);
        setForm(toForm(data.config));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // Alamat dari domain contoh/lokal pasti ditolak Resend (domain harus terverifikasi)
  const fromDomain = form?.fromAddress.split("@")[1]?.toLowerCase() ?? "";
  const placeholderFrom = /(^|\.)(local|localhost|test|invalid|example|example\.com)$/.test(fromDomain);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  // Pratinjau mengikuti isian yang belum disimpan
  const preview = useMemo(
    () =>
      form
        ? sampleEmail(template, {
            name: form.brandName,
            accent: form.accent,
            footerNote: form.footerNote,
          })
        : null,
    [form, template]
  );

  async function save() {
    if (!form) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/email-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          apiKey: form.apiKey || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan konfigurasi email");
      setConfig(data.config);
      setForm(toForm(data.config));
      setNotice({ kind: "success", text: "Konfigurasi email disimpan." });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function runTest(action: "send" | "domains") {
    setTesting(action);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "send" ? { action, to: testTo.trim() } : { action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Uji gagal");
      if (action === "domains") {
        setDomains(data.domains);
        setTestResult({
          kind: "success",
          text: data.domains.length ? "Terhubung ke Resend." : "Terhubung, tetapi belum ada domain di akun Resend.",
        });
      } else {
        setTestResult({ kind: "success", text: data.message });
      }
    } catch (e) {
      setTestResult({ kind: "error", text: (e as Error).message });
    } finally {
      setTesting(null);
    }
  }

  const keyStatus = !config
    ? null
    : config.hasKey
      ? config.apiKeySource === "env"
        ? "Memakai RESEND_API_KEY dari file .env"
        : "Tersimpan terenkripsi di database"
      : "Belum diatur. Email hanya dicatat di log server.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
          <MailCheck className="h-5 w-5 text-primary" />
          Email
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Atur koneksi Resend, pengirim, dan tampilan email yang dikirim ke pelanggan dan admin.
        </p>
      </div>

      {loadError && (
        <Alert variant="error" title="Gagal memuat">
          {loadError}
        </Alert>
      )}

      {!form && !loadError && (
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className={CARD}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-4 h-9 w-full" />
              <Skeleton className="mt-3 h-9 w-full" />
            </div>
          ))}
        </div>
      )}

      {form && config && preview && (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          {/* Kiri: pengaturan */}
          <div className="min-w-0 space-y-6">
            {notice && (
              <Alert
                variant={notice.kind}
                title={notice.kind === "success" ? "Berhasil" : "Gagal"}
                onDismiss={() => setNotice(null)}
              >
                {notice.text}
              </Alert>
            )}

            <section className={CARD}>
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Koneksi Resend
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Status: {keyStatus}
                {config.maskedKey && <span className="font-mono"> ({config.maskedKey})</span>}
              </p>

              <div className="mt-4 space-y-4">
                <Field
                  label="API key"
                  htmlFor="apiKey"
                  hint="Kosongkan untuk mempertahankan key yang tersimpan. Key tidak pernah ditampilkan kembali."
                >
                  <input
                    id="apiKey"
                    type="password"
                    autoComplete="off"
                    value={form.apiKey}
                    onChange={(e) => set("apiKey", e.target.value)}
                    placeholder="re_..."
                    className={INPUT}
                  />
                </Field>
                {config.apiKeySource === "database" && (
                  <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={form.clearApiKey}
                      onChange={(e) => set("clearApiKey", e.target.checked)}
                    />
                    Hapus key dari database (kembali ke .env)
                  </label>
                )}
              </div>

              <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                <p className="text-sm font-medium text-foreground">Uji koneksi</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Simpan perubahan lebih dulu; uji memakai konfigurasi yang tersimpan.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="email tujuan uji"
                    aria-label="Email tujuan uji"
                    className={INPUT}
                  />
                  <button
                    type="button"
                    onClick={() => runTest("send")}
                    disabled={testing !== null || !testTo.trim()}
                    className={`${BTN} shrink-0 bg-primary text-white hover:bg-primary-hover`}
                  >
                    <Send className="h-4 w-4" />
                    {testing === "send" ? "Mengirim…" : "Kirim uji"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => runTest("domains")}
                  disabled={testing !== null}
                  className={`${BTN} mt-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
                >
                  {testing === "domains" ? "Memeriksa…" : "Cek domain"}
                </button>

                {testResult && (
                  <Alert
                    className="mt-3"
                    variant={testResult.kind}
                    title={testResult.kind === "success" ? "Berhasil" : "Gagal"}
                  >
                    {testResult.text}
                  </Alert>
                )}
                {domains && domains.length > 0 && (
                  <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
                    {domains.map((d) => (
                      <li key={d.name} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="min-w-0 truncate font-mono text-xs">{d.name}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === "verified"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}
                        >
                          {d.status === "verified" ? "terverifikasi" : d.status || "belum"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className={CARD}>
              <h2 className="text-sm font-bold text-foreground">Pengirim &amp; penerima</h2>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nama pengirim" htmlFor="fromName">
                    <input id="fromName" value={form.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Article" className={INPUT} />
                  </Field>
                  <Field
                    label="Alamat pengirim"
                    htmlFor="fromAddress"
                    hint={
                      placeholderFrom
                        ? `Domain ${fromDomain} adalah contoh dan akan ditolak Resend. Pakai alamat dari domain yang sudah terverifikasi di resend.com/domains.`
                        : "Harus memakai domain yang terverifikasi di Resend."
                    }
                  >
                    <input id="fromAddress" type="email" value={form.fromAddress} onChange={(e) => set("fromAddress", e.target.value)} placeholder="noreply@domain.com" className={INPUT} />
                  </Field>
                </div>
                <Field label="Reply-to" htmlFor="replyTo" hint="Opsional. Balasan pelanggan masuk ke alamat ini.">
                  <input id="replyTo" type="email" value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} placeholder="admin@domain.com" className={INPUT} />
                </Field>
                <Field label="Penerima notifikasi admin" htmlFor="adminRecipients" hint="Pisahkan beberapa alamat dengan koma.">
                  <input id="adminRecipients" value={form.adminRecipients} onChange={(e) => set("adminRecipients", e.target.value)} placeholder="admin@domain.com, tim@domain.com" className={INPUT} />
                </Field>
              </div>
            </section>

            <section className={CARD}>
              <h2 className="text-sm font-bold text-foreground">Tampilan email</h2>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nama brand" htmlFor="brandName">
                    <input id="brandName" value={form.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="Article" className={INPUT} />
                  </Field>
                  <Field label="Warna tombol" htmlFor="accent">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Pilih warna tombol"
                        value={/^#[0-9a-fA-F]{6}$/.test(form.accent) ? form.accent : "#0a0a0a"}
                        onChange={(e) => set("accent", e.target.value)}
                        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
                      />
                      <input id="accent" value={form.accent} onChange={(e) => set("accent", e.target.value)} placeholder="#0a0a0a" className={`${INPUT} font-mono`} />
                    </div>
                  </Field>
                </div>
                <Field label="Catatan footer" htmlFor="footerNote" hint="Tampil di bagian bawah semua email. Kosongkan untuk menyembunyikan.">
                  <input id="footerNote" value={form.footerNote} onChange={(e) => set("footerNote", e.target.value)} className={INPUT} />
                </Field>
              </div>
            </section>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={`${BTN} w-full bg-primary text-white hover:bg-primary-hover sm:w-auto`}
            >
              <Save className="h-4 w-4" />
              {saving ? "Menyimpan…" : "Simpan konfigurasi"}
            </button>
          </div>

          {/* Kanan: pratinjau */}
          <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <section className={CARD}>
              <h2 className="text-sm font-bold text-foreground">Pratinjau email</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Mengikuti isian di kiri, termasuk yang belum disimpan. Data di dalamnya contoh.
              </p>
              <div role="tablist" aria-label="Jenis email" className="mt-4 flex flex-wrap gap-1.5">
                {EMAIL_TEMPLATE_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={template === key}
                    onClick={() => setTemplate(key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      template === key
                        ? "bg-primary text-white"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {EMAIL_TEMPLATE_LABELS[key]}
                  </button>
                ))}
              </div>
              <p className="mt-3 truncate text-xs text-zinc-500 dark:text-zinc-400">
                Subjek: <span className="text-foreground">{preview.subject}</span>
              </p>
              <iframe
                title="Pratinjau email"
                sandbox=""
                srcDoc={preview.html}
                className="mt-3 h-[640px] w-full rounded-lg border border-zinc-200 bg-white dark:border-zinc-800"
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
