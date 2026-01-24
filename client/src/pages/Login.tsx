import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, User, Mail, KeyRound, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoImage from "@assets/image_1767220512226.png";
import { getProductImage } from "@/lib/productImages";

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
  const [resetStep, setResetStep] = useState<"email" | "code" | "newPassword">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<{name: string, image: string, origin: {x: number, y: number}} | null>(null);

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

  const handleRequestReset = async () => {
    if (!resetEmail) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }
    setIsResetting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Success", description: "Reset code sent to your email" });
        setResetStep("code");
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send reset code", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!resetCode) {
      toast({ title: "Error", description: "Please enter the code", variant: "destructive" });
      return;
    }
    setIsResetting(true);
    try {
      const response = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, code: resetCode }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Success", description: "Code verified" });
        setResetStep("newPassword");
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to verify code", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Error", description: "Password must be at least 4 characters", variant: "destructive" });
      return;
    }
    setIsResetting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Success", description: "Password reset successfully. Please login with your new password." });
        setShowForgotPassword(false);
        setResetStep("email");
        setResetEmail("");
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset password", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setResetStep("email");
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
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
                    variant="ghost"
                    className="text-sm text-muted-foreground"
                    onClick={() => setShowForgotPassword(true)}
                    data-testid="button-forgot-password"
                  >
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
                  className={`${service.color} text-white rounded-lg p-4 text-center font-semibold shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer relative overflow-hidden`}
                  style={{ animationDelay: `${index * 100}ms` }}
                  onMouseEnter={(e) => {
                    const image = getProductImage(service.name);
                    if (image) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = rect.left + rect.width / 2;
                      const y = rect.top + rect.height / 2;
                      setFullScreenImage({ name: service.name, image, origin: { x, y } });
                    }
                  }}
                  onMouseLeave={() => setFullScreenImage(null)}
                  data-testid={`service-box-${index}`}
                >
                  {service.name}
                </div>
              ))}
            </div>
            <p className="text-center mt-6 text-muted-foreground text-sm">
              Professional cleaning for 43+ laundry items
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Click on any item to see image
            </p>
          </div>
        </div>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={closeForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetStep === "email" && "Enter your email address to receive a reset code."}
              {resetStep === "code" && "Enter the 6-digit code sent to your email."}
              {resetStep === "newPassword" && "Create a new password for your account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {resetStep === "email" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10"
                      data-testid="input-reset-email"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleRequestReset}
                  disabled={isResetting}
                  data-testid="button-send-code"
                >
                  {isResetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Reset Code
                </Button>
              </>
            )}

            {resetStep === "code" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Verification Code</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reset-code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="pl-10 text-center text-lg tracking-widest"
                      maxLength={6}
                      data-testid="input-reset-code"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleVerifyCode}
                  disabled={isResetting}
                  data-testid="button-verify-code"
                >
                  {isResetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify Code
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setResetStep("email")}
                  data-testid="button-back-to-email"
                >
                  Back
                </Button>
              </>
            )}

            {resetStep === "newPassword" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      data-testid="input-new-password"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleResetPassword}
                  disabled={isResetting}
                  data-testid="button-reset-password"
                >
                  {isResetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Reset Password
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 pointer-events-none animate-in fade-in duration-150"
          data-testid="fullscreen-image-overlay"
        >
          <div 
            className="max-w-sm w-full relative text-center genie-popup"
            style={{
              '--origin-x': `${fullScreenImage.origin.x}px`,
              '--origin-y': `${fullScreenImage.origin.y}px`,
            } as React.CSSProperties}
          >
            <img 
              src={fullScreenImage.image} 
              alt={fullScreenImage.name}
              className="w-full h-72 object-contain drop-shadow-2xl"
              data-testid="img-fullscreen-service"
            />
            <h3 className="text-white text-xl font-bold mt-3 drop-shadow-lg">{fullScreenImage.name}</h3>
          </div>
        </div>
      )}
    </div>
  );
}
