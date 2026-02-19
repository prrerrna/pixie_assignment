import "./globals.css";

export const metadata = {
  title: "Pixie Event Tracker | Analytics Dashboard",
  description: "Real-time event analytics scraped from BookMyShow across Indian cities",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
