import { SignIn, SignUp } from '@clerk/clerk-react'
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

const AuthPage = () => {
  const [isSignIn, setIsSignIn] = useState(true)

  return (
    <div className="min-h-screen bg-[#212121] flex flex-col items-center justify-center p-4">


      {/* ✅ Clerk SignIn / SignUp component */}
      <div className="w-full max-w-md">
        {isSignIn ? (
          <SignIn
            
          />
        ) : (
          <SignUp
            
          />
        )}
      </div>

    </div>
  )
}

export default AuthPage