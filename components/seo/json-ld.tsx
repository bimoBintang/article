/**
 * Komponen JSON-LD (structured data) untuk rich result di search engine.
 *
 * Dipakai di halaman server component. Google membaca
 * `<script type="application/ld+json">` langsung dari HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify sudah aman untuk konten yang dikontrol server;
      // "<" diganti agar tidak menutup tag script lebih awal.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
