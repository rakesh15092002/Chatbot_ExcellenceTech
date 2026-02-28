import { SignIn, SignUp } from '@clerk/clerk-react'
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

const AuthPage = () => {
  const [isSignIn, setIsSignIn] = useState(true)

  return (
    <div className="min-h-screen bg-[#212121] flex flex-col items-center justify-center p-4">

      {/* Brand */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-600 rounded-xl">
          <ShieldCheck size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-white text-xl font-bold">Excellence Technology</h1>
          <p className="text-gray-400 text-xs">AI Orbit v1.0 — PDF Chat Assistant</p>
        </div>
      </div>

      {/* ✅ Clerk SignIn / SignUp component */}
      <div className="w-full max-w-md">
        {isSignIn ? (
          <SignIn
            appearance={{
              elements: {
                rootBox:           "w-full",
                card:              "bg-[#2f2f2f] border border-white/10 shadow-2xl rounded-2xl",
                headerTitle:       "text-white",
                headerSubtitle:    "text-gray-400",
                socialButtonsBlockButton: "bg-[#1a1a1a] border border-white/10 text-white hover:bg-[#3f3f3f]",
                dividerLine:       "bg-white/10",
                dividerText:       "text-gray-500",
                formFieldLabel:    "text-gray-300",
                formFieldInput:    "bg-[#1a1a1a] border-white/10 text-white rounded-lg",
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
                footerActionLink:  "text-blue-400 hover:text-blue-300",
                identityPreviewText:    "text-gray-300",
                identityPreviewEditButton: "text-blue-400",
              }
            }}
          />
        ) : (
          <SignUp
            appearance={{
              elements: {
                rootBox:           "w-full",
                card:              "bg-[#2f2f2f] border border-white/10 shadow-2xl rounded-2xl",
                headerTitle:       "text-white",
                headerSubtitle:    "text-gray-400",
                socialButtonsBlockButton: "bg-[#1a1a1a] border border-white/10 text-white hover:bg-[#3f3f3f]",
                dividerLine:       "bg-white/10",
                dividerText:       "text-gray-500",
                formFieldLabel:    "text-gray-300",
                formFieldInput:    "bg-[#1a1a1a] border-white/10 text-white rounded-lg",
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
                footerActionLink:  "text-blue-400 hover:text-blue-300",
              }
            }}
          />
        )}
      </div>

      {/* ✅ Toggle between Sign In / Sign Up */}
      <p className="mt-4 text-gray-500 text-sm">
        {isSignIn ? "Don't have an account?" : "Already have an account?"}
        <button
          onClick={() => setIsSignIn(prev => !prev)}
          className="ml-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          {isSignIn ? "Sign Up" : "Sign In"}
        </button>
      </p>
    </div>
  )
}

export default AuthPage