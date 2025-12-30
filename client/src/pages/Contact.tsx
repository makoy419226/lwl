import { Phone, Mail, Globe, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Contact() {
  return (
    <div className="flex flex-col h-screen">
      <div className="sticky top-0 z-30 w-full bg-white/80 dark:bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="h-20 px-6 flex items-center">
          <h1 className="text-2xl font-display font-bold text-foreground">
            Contact Us
          </h1>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <Card className="overflow-hidden">
            <div className="bg-primary p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold font-display text-2xl">
                  L
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Liquid Washes</h2>
                  <p className="text-white/80 text-sm">Professional Laundry Services</p>
                </div>
              </div>
            </div>
            
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Telephone</p>
                  <a 
                    href="tel:026815824" 
                    className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                    data-testid="link-tel"
                  >
                    026 815 824
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Mobile Phone</p>
                  <a 
                    href="tel:+971563380001" 
                    className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                    data-testid="link-phone"
                  >
                    +971 56 338 0001
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <a 
                    href="mailto:info@lwl.ae" 
                    className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                    data-testid="link-email"
                  >
                    info@lwl.ae
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Website</p>
                  <a 
                    href="https://www.lwl.ae" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                    data-testid="link-website"
                  >
                    www.lwl.ae
                  </a>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  className="w-full rounded-full"
                  size="lg"
                  onClick={() => window.open("https://wa.me/971563380001", "_blank")}
                  data-testid="button-whatsapp"
                >
                  Contact via WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
