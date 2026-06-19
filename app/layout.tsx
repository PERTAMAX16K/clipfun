import type { Metadata } from "next";
import "@/app/globals.css";
import { AppProviders } from "@/app/providers";
import { DemoProvider } from "@/components/demo-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Clipfun — Fund the brief. Earn the proof.",
  description:
    "An onchain campaign marketplace for brands and short-form creators.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <DemoProvider>
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
          </DemoProvider>
        </AppProviders>
      </body>
    </html>
  );
}
