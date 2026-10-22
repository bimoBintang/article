"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Save, ShieldCheck, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_GROUPS, type PaymentMethod, type PaymentMethodId } from "@/lib/payment-methods";
import type { MidtransConfigPublic } from "@/lib/midtrans-settings";

type Form = {
  serverKey: string;
  clearServerKey: boolean;
  isProduction: boolean;
  enabledMethods: PaymentMethodId[];
  expiryHours: string;
};

type TestResult = { ok: boolean; mode: string; endpoint: string; message: string };

const INPUT =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900";
const CARD =
  "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

function toForm(c: MidtransConfigPublic): Form {
  return {
    serverKey: "",
    clearServerKey: false,
    isProduction: c.isProduction,
    enabledMethods: c.enabledMethods,
    expiryHours: String(c.expiryHours),
  };
}

function Row({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {label}
      </span>
      <span className="min-w-0 break-words text-right font-medium text-foreground">{value}</span>
    </li>
  );
}

export default function AdminMidtransPage() {
  const [config, setConfig] = useState<MidtransConfigPublic | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/midtrans-config", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Gagal memuat konfigurasi Midtrans");
        setConfig(data.config);
        setMethods(data.methods);
        setForm(toForm(data.config));
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setWebhookUrl(`${window.location.origin}/api/webhooks/midtrans`));
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  function toggleMethod(id: PaymentMethodId) {
    setForm((f) =>
      f
        ? {
            ...f,
            enabledMethods: f.enabledMethods.includes(id)
              ? f.enabledMethods.filter((m) => m !== id)
              : [...f.enabledMethods, id],
          }
        : f
    );
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/midtrans-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverKey: form.serverKey.trim(),
          clearServerKey: form.clearServerKey,
          isProduction: form.isProduction,
          enabledMethods: form.enabledMethods,
          expiryHours: Number(form.expiryHours),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan konfigurasi Midtrans");
      setConfig(data.config);
      setForm(toForm(data.config));
      setTestResult(null);
      setNotice({ kind: "success", text: "Konfigurasi Midtrans disimpan." });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      // Menguji isian saat ini (key yang diketik dan mode), tanpa menyimpannya
      const res = await fetch("/api/admin/midtrans-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverKey: form?.serverKey.trim() ?? "", isProduction: form?.isProduction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Uji koneksi gagal");
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, mode: "", endpoint: "", message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard diblokir; URL tetap terlihat untuk disalin manual
    }
  }

  const dirty =
    !!form &&
    !!config &&
    (form.serverKey !== "" ||
      form.clearServerKey ||
      form.isProduction !== config.isProduction ||
      form.expiryHours !== String(config.expiryHours) ||
      [...form.enabledMethods].sort().join() !== [...config.enabledMethods].sort().join());

  // Mode yang ditunjukkan key (yang baru diketik, atau yang tersimpan)
  const typed = form?.serverKey.trim() ?? "";
  const keyMode = typed
    ? typed.startsWith("SB-Mid-server-")
      ? "sandbox"
      : typed.startsWith("Mid-server-")
        ? "production"
        : null
    : config?.keyMode ?? null;
  const formMode = form?.isProduction ? "production" : "sandbox";
  const mismatch = keyMode !== null && keyMode !== formMode;

  const keyStatus = !config
    ? ""
    : config.placeholderKey
      ? "Masih berisi nilai contoh. Isi dengan Server Key asli."
      : config.hasKey
        ? config.serverKeySource === "env"
          ? "Memakai MIDTRANS_SERVER_KEY dari file .env"
          : "Tersimpan terenkripsi di database"
        : "Belum diatur. Pembayaran online belum bisa dipakai.";

  const configured = !!config?.hasKey && !config.placeholderKey;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
          <Wallet className="h-5 w-5 text-primary" />
          Midtrans
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Atur Server Key, mode, metode pembayaran, dan masa berlaku untuk pembayaran lewat Midtrans Core API.
        </p>
      </div>

      {loadError && (
        <Alert variant="error" title="Gagal memuat">
          {loadError}
        </Alert>
      )}

      {!form && !loadError && (
        <div className="grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={CARD}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-4 h-9 w-full" />
              <Skeleton className="mt-3 h-9 w-full" />
            </div>
          ))}
        </div>
      )}

      {form && config && (
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
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
                Koneksi
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Status: {keyStatus}
                {config.maskedKey && !config.placeholderKey && <span className="font-mono"> ({config.maskedKey})</span>}
              </p>

              <div className="mt-4">
                <p className="mb-1.5 text-sm font-medium text-foreground" id="mode-label">
                  Mode
                </p>
                <div role="radiogroup" aria-labelledby="mode-label" className="grid grid-cols-2 gap-2">
                  {(
                    [
                      [false, "Sandbox", "Uji coba, tanpa uang sungguhan"],
                      [true, "Produksi", "Transaksi nyata"],
                    ] as const
                  ).map(([prod, label, hint]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={form.isProduction === prod}
                      data-mode={prod ? "production" : "sandbox"}
                      onClick={() => set("isProduction", prod)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        form.isProduction === prod
                          ? "border-primary bg-primary/10"
                          : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="block text-sm font-medium text-foreground">{label}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="serverKey" className="mb-1.5 block text-sm font-medium text-foreground">
                  Server Key
                </label>
                <input
                  id="serverKey"
                  type="password"
                  autoComplete="off"
                  value={form.serverKey}
                  onChange={(e) => set("serverKey", e.target.value)}
                  placeholder={form.isProduction ? "Mid-server-..." : "SB-Mid-server-..."}
                  className={`${INPUT} font-mono`}
                />
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Kosongkan untuk mempertahankan key yang tersimpan. Key tidak pernah ditampilkan kembali. Ambil di dashboard
                  Midtrans: Settings &gt; Access Keys.
                </p>
              </div>

              {config.serverKeySource === "database" && (
                <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={form.clearServerKey}
                    onChange={(e) => set("clearServerKey", e.target.checked)}
                  />
                  Hapus key dari database (kembali ke .env)
                </label>
              )}

              {mismatch && (
                <div className="mt-4">
                  <Alert variant="warning" title="Mode tidak cocok dengan key">
                    Key ini untuk mode {keyMode === "sandbox" ? "Sandbox" : "Produksi"}, tetapi mode yang dipilih{" "}
                    {formMode === "sandbox" ? "Sandbox" : "Produksi"}. Midtrans akan menolak transaksi sampai keduanya sama.
                  </Alert>
                </div>
              )}
              {form.isProduction && !mismatch && (
                <div className="mt-4">
                  <Alert variant="info" title="Mode Produksi">
                    Pembayaran memakai uang sungguhan. Invoice yang sedang berjalan di Sandbox tidak ikut berpindah.
                  </Alert>
                </div>
              )}

              <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                <p className="text-sm font-medium text-foreground">Uji koneksi</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Memeriksa Server Key yang diketik di atas (atau yang tersimpan bila kolom kosong) pada mode yang
                  dipilih, tanpa menyimpan dan tanpa membuat transaksi.
                </p>
                <button
                  type="button"
                  onClick={runTest}
                  disabled={testing}
                  className={`${BTN} mt-3 border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
                >
                  {testing ? "Memeriksa…" : "Uji koneksi"}
                </button>
                {testResult && (
                  <Alert
                    className="mt-3"
                    variant={testResult.ok ? "success" : "error"}
                    title={testResult.ok ? "Terhubung" : "Gagal"}
                  >
                    {testResult.message}
                    {testResult.endpoint && (
                      <span className="mt-1 block font-mono text-xs opacity-80">{testResult.endpoint}</span>
                    )}
                  </Alert>
                )}
              </div>
            </section>

            <section className={CARD}>
              <h2 className="text-sm font-bold text-foreground">Metode pembayaran</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Hanya metode yang dicentang tampil di halaman bayar pelanggan. Minimal satu.
              </p>
              <div className="mt-4 space-y-5">
                {PAYMENT_GROUPS.map((group) => (
                  <fieldset key={group.id}>
                    <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {group.label}
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {methods
                        .filter((m) => m.group === group.id)
                        .map((m) => {
                          const on = form.enabledMethods.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                                on
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleMethod(m.id)}
                                data-method={m.id}
                              />
                              {m.label}
                            </label>
                          );
                        })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>

            <section className={CARD}>
              <h2 className="text-sm font-bold text-foreground">Masa berlaku pembayaran</h2>
              <div className="mt-4 max-w-xs">
                <label htmlFor="expiryHours" className="mb-1.5 block text-sm font-medium text-foreground">
                  Batas waktu bayar (jam)
                </label>
                <input
                  id="expiryHours"
                  type="number"
                  min={1}
                  max={72}
                  inputMode="numeric"
                  value={form.expiryHours}
                  onChange={(e) => set("expiryHours", e.target.value)}
                  className={INPUT}
                />
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  1 sampai 72 jam. Berlaku untuk setiap kode bayar baru; pelanggan bisa memilih metode lagi setelah kedaluwarsa.
                </p>
              </div>
            </section>

            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className={`${BTN} w-full bg-primary text-white hover:bg-primary-hover sm:w-auto`}
            >
              <Save className="h-4 w-4" />
              {saving ? "Menyimpan…" : "Simpan konfigurasi"}
            </button>
          </div>

          <div className="min-w-0 space-y-6">
            <section className={CARD}>
              <h2 className="text-sm font-bold text-foreground">Status integrasi</h2>
              <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                <Row ok={configured} label="Server Key" value={configured ? "Terpasang" : "Belum siap"} />
                <Row ok label="Mode" value={config.isProduction ? "Produksi" : "Sandbox"} />
                <Row
                  ok={config.enabledMethods.length > 0}
                  label="Metode aktif"
                  value={`${config.enabledMethods.length} dari ${methods.length}`}
                />
                <Row ok label="Masa berlaku" value={`${config.expiryHours} jam`} />
                <Row ok label="Endpoint" value={config.endpoint.replace(/^https?:\/\//, "")} />
              </ul>
            </section>

            <section className={CARD}>
              <h2 className="text-sm font-bold text-foreground">URL notifikasi</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Midtrans memberi kabar pembayaran ke alamat ini.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-foreground dark:bg-zinc-800">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={copyWebhook}
                  aria-label="Salin URL notifikasi"
                  className="shrink-0 rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                <li>Salin URL di atas.</li>
                <li>Buka dashboard Midtrans, Settings &gt; Configuration.</li>
                <li>Tempel ke kolom Payment Notification URL, lalu simpan.</li>
              </ol>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Harus alamat publik (HTTPS disarankan). Saat berjalan di localhost, status tetap diperbarui lewat pengecekan
                otomatis di halaman bayar atau tombol Sinkronkan di detail invoice.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
