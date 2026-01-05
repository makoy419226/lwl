import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, User, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoImage from "@assets/image_1767220512226.png";

export interface UserInfo {
  id: number;
  username: string;
  role: string;
  name: string;
}

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("user", JSON.stringify(data.user));
        toast({
          title: `Welcome, ${data.user.name || data.user.username}!`,
          description: `Logged in as ${data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1)}`,
        });
        onLogin(data.user);
        setLocation("/");
      } else {
        toast({
          title: "Login Failed",
          description: data.message || "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const services = [
    { name: "Kandoora", color: "bg-blue-500" },
    { name: "Abaya", color: "bg-purple-500" },
    { name: "Saree", color: "bg-pink-500" },
    { name: "Suit", color: "bg-indigo-500" },
    { name: "Shirt", color: "bg-cyan-500" },
    { name: "Jeans", color: "bg-teal-500" },
    { name: "Blanket", color: "bg-orange-500" },
    { name: "Carpet", color: "bg-red-500" },
    { name: "Curtain", color: "bg-emerald-500" },
    { name: "Towel", color: "bg-amber-500" },
    { name: "Shoes", color: "bg-rose-500" },
    { name: "Jacket", color: "bg-violet-500" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-center">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <img 
                  src={logoImage} 
                  alt="Liquide Washes Laundry" 
                  className="h-20 object-contain"
                  data-testid="img-login-logo"
                />
              </div>
              <CardTitle className="text-2xl font-bold text-primary">Admin Portal</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Liquide Washes Laundry Management System
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Login
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-muted-foreground"
                    onClick={() => setShowForgotPassword(true)}
                    data-testid="button-forgot-password"
                  >
                    <HelpCircle className="w-4 h-4 mr-1" />
                    Forgot Password?
                  </Button>
                </div>
              </form>

              <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Liquide Washes Laundry</p>
                <p>Centra Market D/109, Al Dhanna City</p>
                <p>Al Ruwais, Abu Dhabi - UAE</p>
              </div>
            </CardContent>
          </Card>

          <div className="hidden lg:block flex-1">
            <h2 className="text-2xl font-bold text-center mb-6 text-foreground">Our Laundry Services</h2>
            <div className="grid grid-cols-3 gap-3">
              {services.map((service, index) => (
                <div
                  key={index}
                  className={`${service.color} text-white rounded-lg p-4 text-center font-semibold shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl`}
                  style={{ animationDelay: `${index * 100}ms` }}
                  data-testid={`service-box-${index}`}
                >
                  {service.name}
                </div>
              ))}
            </div>
            <p className="text-center mt-6 text-muted-foreground text-sm">
              Professional cleaning for 43+ laundry items
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
