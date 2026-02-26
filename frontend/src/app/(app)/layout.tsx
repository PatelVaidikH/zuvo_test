import Navbar from "@/components/layout/Navbar";
import { Toaster } from "sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      {/* This is where the actual page content (like /home or /teams) will render.
        It sits safely below the global Navbar.
      */}
      <main className="flex-1 w-full">{children}</main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "bg-card border border-border text-foreground shadow-lg rounded-xl text-sm font-medium",
            description: "text-muted-foreground text-xs",
            actionButton:
              "bg-primary text-primary-foreground text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition-opacity",
            cancelButton:
              "bg-secondary text-muted-foreground text-xs font-semibold rounded-md px-3 py-1.5 hover:bg-secondary/80 transition-colors",
            error:
              "bg-destructive/10 border-destructive/30 text-destructive",
            success:
              "bg-card border-border text-foreground",
          },
        }}
        richColors
      />
    </div>
  );
}
