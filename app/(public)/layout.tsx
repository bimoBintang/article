import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({ children }: LayoutProps<"/">) {
 return (
 <div className="theme-public flex min-h-screen flex-col bg-paper">
 <SiteHeader />
 <main className="flex-1">{children}</main>
 <SiteFooter />
 </div>
 );
}
