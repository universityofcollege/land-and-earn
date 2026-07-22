import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FundGuide · Funding Allocation Assistant",
  description: "Source-grounded funding recommendations for nonprofit grant teams.",
  openGraph: {
    title: "FundGuide · Funding Allocation Assistant",
    description: "Put every expense on the right funding path.",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "FundGuide funding allocation assistant" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FundGuide · Funding Allocation Assistant",
    description: "Put every expense on the right funding path.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
