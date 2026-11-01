import Navigation from "@/components/Navigation";
import { SignIn, SignUp } from "@clerk/react";

export function SignInPage() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container flex justify-center py-12">
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container flex justify-center py-12">
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
    </div>
  );
}
