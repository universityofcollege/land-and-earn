import type { Metadata } from "next";
import "./globals.css";

const deploymentOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(deploymentOrigin),
  title: "Land & Earn · Grant Operations",
  description: "Reimbursement operations for the Land and Earn internship program.",
  openGraph: { title: "Land & Earn · Grant Operations", description: "Evidence-ready employer reimbursements, on time.", type: "website", images: [{ url: "/og-land-and-earn.png", width: 1674, height: 941, alt: "Land & Earn grant operations" }] },
  twitter: { card: "summary_large_image", title: "Land & Earn · Grant Operations", description: "Evidence-ready employer reimbursements, on time.", images: ["/og-land-and-earn.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
