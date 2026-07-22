import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Land & Earn · Grant Operations",
  description: "Reimbursement operations for the Land and Earn internship program.",
  openGraph: { title: "Land & Earn · Grant Operations", description: "Evidence-ready employer reimbursements, on time.", type: "website", images: [{ url: "/og-land-and-earn.png", width: 1674, height: 941, alt: "Land & Earn grant operations" }] },
  twitter: { card: "summary_large_image", title: "Land & Earn · Grant Operations", description: "Evidence-ready employer reimbursements, on time.", images: ["/og-land-and-earn.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
